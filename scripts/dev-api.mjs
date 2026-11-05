/**
 * Local API server for Vite proxy — vercel CLI currently lets Vite own :PORT
 * and never invokes serverless functions under api/.
 *
 * Usage: node scripts/dev-api.mjs
 * Default: http://127.0.0.1:3040
 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const PORT = Number(process.env.DEV_API_PORT || 3040);

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile(path.join(root, ".env.local"));

const ROUTES = [
  { match: /^\/api\/platform\/([^/]+)\/?$/, file: "api/platform/[action].js", param: "action" },
  { match: /^\/api\/ai\/([^/]+)\/?$/, file: "api/ai/[action].js", param: "action" },
  { match: /^\/api\/webhooks\/([^/]+)\/?$/, file: "api/webhooks/[provider].js", param: "provider" },
  { match: /^\/api\/conversations\/([^/]+)\/?$/, file: "api/conversations/[action].js", param: "action" },
  { match: /^\/api\/calls\/([^/]+)\/?$/, file: "api/calls/[action].js", param: "action" },
  { match: /^\/api\/video\/ingest\/?$/, file: "api/video/ingest.js" },
  { match: /^\/api\/push\/send\/?$/, file: "api/push/send.js" },
  { match: /^\/api\/payments\/checkout\/?$/, file: "api/payments/checkout.js" },
  { match: /^\/api\/email\/send\/?$/, file: "api/email/send.js" },
  { match: /^\/api\/account\/delete\/?$/, file: "api/account/delete.js" },
];

const handlerCache = new Map();

async function loadHandler(relFile) {
  if (handlerCache.has(relFile)) return handlerCache.get(relFile);
  const abs = path.join(root, relFile);
  const mod = await import(pathToFileURL(abs).href);
  handlerCache.set(relFile, mod.default);
  return mod.default;
}

function createRes(nodeRes) {
  let statusCode = 200;
  const res = {
    statusCode,
    status(code) {
      statusCode = code;
      this.statusCode = code;
      nodeRes.statusCode = code;
      return this;
    },
    setHeader(name, value) {
      nodeRes.setHeader(name, value);
      return this;
    },
    getHeader(name) {
      return nodeRes.getHeader(name);
    },
    json(payload) {
      if (!nodeRes.getHeader("Content-Type")) {
        nodeRes.setHeader("Content-Type", "application/json; charset=utf-8");
      }
      nodeRes.statusCode = statusCode;
      nodeRes.end(JSON.stringify(payload));
      return this;
    },
    send(payload) {
      nodeRes.statusCode = statusCode;
      if (payload == null) {
        nodeRes.end();
        return this;
      }
      if (typeof payload === "object" && !Buffer.isBuffer(payload)) {
        return this.json(payload);
      }
      nodeRes.end(payload);
      return this;
    },
    end(chunk) {
      nodeRes.statusCode = statusCode;
      nodeRes.end(chunk);
      return this;
    },
  };
  return res;
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

function parseQuery(searchParams) {
  const query = {};
  for (const [key, value] of searchParams.entries()) {
    query[key] = value;
  }
  return query;
}

const server = http.createServer(async (nodeReq, nodeRes) => {
  try {
    const url = new URL(nodeReq.url || "/", `http://127.0.0.1:${PORT}`);
    const pathname = url.pathname;

    const route = ROUTES.find((r) => r.match.test(pathname));
    if (!route) {
      nodeRes.statusCode = 404;
      nodeRes.setHeader("Content-Type", "application/json");
      nodeRes.end(JSON.stringify({ error: `No local route for ${pathname}` }));
      return;
    }

    const m = pathname.match(route.match);
    const query = parseQuery(url.searchParams);
    if (route.param && m?.[1]) query[route.param] = decodeURIComponent(m[1]);

    const raw = await readBody(nodeReq);
    let body = undefined;
    const contentType = String(nodeReq.headers["content-type"] || "");
    if (raw.length) {
      if (contentType.includes("application/json")) {
        try {
          body = JSON.parse(raw.toString("utf8"));
        } catch {
          body = raw.toString("utf8");
        }
      } else {
        body = raw;
      }
    }

    const req = {
      method: nodeReq.method || "GET",
      url: nodeReq.url,
      headers: nodeReq.headers,
      query,
      body,
    };

    const res = createRes(nodeRes);
    const handler = await loadHandler(route.file);
    await handler(req, res);

    if (!nodeRes.writableEnded) {
      nodeRes.end();
    }
  } catch (error) {
    console.error("[dev-api]", error);
    if (!nodeRes.headersSent) {
      nodeRes.statusCode = 500;
      nodeRes.setHeader("Content-Type", "application/json");
      nodeRes.end(JSON.stringify({ error: error?.message || "Local API error" }));
    }
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[dev-api] listening on http://127.0.0.1:${PORT}`);
  console.log(`[dev-api] blob configured: ${Boolean(process.env.BLOB_READ_WRITE_TOKEN)}`);
});
