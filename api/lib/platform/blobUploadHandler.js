import { applyCors, handleCorsPreflight } from "../cors.js";
import { authenticateRequest } from "../payment/auth.js";
import { applyRateLimit, getClientIp } from "../rateLimit.js";
import { isBlobConfigured, putBlob } from "../blob.js";

const ALLOWED_PREFIXES = new Set(["uploads", "avatars", "covers", "voice"]);

function parseMultipart(req) {
  // Vercel / Node may already parse; support raw body buffer + JSON fallback.
  return req.body;
}

export default async function handler(req, res) {
  if (handleCorsPreflight(req, res)) return;
  applyCors(req, res);

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!isBlobConfigured()) {
    return res.status(503).json({ error: "Vercel Blob is not configured." });
  }

  const auth = await authenticateRequest(req);
  if (auth.error) {
    return res.status(auth.error.status).json({ error: auth.error.message });
  }

  const ip = getClientIp(req);
  if (!(await applyRateLimit(req, res, `blob-upload:${auth.user.id}:${ip}`, { limit: 40, windowMs: 60_000 }))) {
    return;
  }

  try {
    const body = parseMultipart(req);
    const {
      filename,
      contentType,
      kind = "uploads",
      chatId,
      dataBase64,
    } = body ?? {};

    if (!dataBase64 || !filename) {
      return res.status(400).json({
        error: "filename and dataBase64 are required.",
      });
    }

    const prefix = ALLOWED_PREFIXES.has(kind) ? kind : "uploads";
    const safeName = String(filename).replace(/[^a-zA-Z0-9._-]/g, "_");
    const ext = safeName.includes(".") ? safeName.split(".").pop() : "bin";
    const stamp = Date.now();
    let pathname;
    if (prefix === "voice") {
      if (!chatId) {
        return res.status(400).json({ error: "chatId is required for voice uploads." });
      }
      pathname = `voice/${auth.user.id}/${chatId}/${stamp}.${ext}`;
    } else if (prefix === "avatars") {
      pathname = `avatars/${auth.user.id}/${stamp}.${ext}`;
    } else if (prefix === "covers") {
      pathname = `covers/${auth.user.id}/cover-${stamp}.${ext}`;
    } else {
      pathname = `uploads/${auth.user.id}/${stamp}.${ext}`;
    }

    const buffer = Buffer.from(dataBase64, "base64");
    if (buffer.length > 12 * 1024 * 1024) {
      return res.status(413).json({ error: "File too large (max 12MB)." });
    }

    const result = await putBlob(pathname, buffer, {
      contentType: contentType || "application/octet-stream",
      access: "public",
    });

    return res.status(200).json({
      path: result.pathname,
      publicUrl: result.url,
    });
  } catch (error) {
    console.error("blob upload error:", error);
    return res.status(500).json({ error: error?.message || "Upload failed" });
  }
}
