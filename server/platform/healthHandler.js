import { applyCors, handleCorsPreflight } from "../cors.js";
import { isNeonConfigured, pingNeon, getNeonSql } from "../neon.js";
import { isRedisConfigured, getRedis } from "../redis.js";
import { isBlobConfigured } from "../blob.js";

const COUNT_TABLES = ["profiles", "posts", "messages", "conversations"];

async function supabasePing() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return { configured: false };
  try {
    const res = await fetch(`${url}/rest/v1/profiles?select=id&limit=1`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
    });
    return { configured: true, ok: res.ok, status: res.status };
  } catch (error) {
    return { configured: true, ok: false, error: error?.message || String(error) };
  }
}

async function neonCounts() {
  if (process.env.DUAL_RUN_VALIDATE !== "true") return undefined;
  const sql = getNeonSql();
  const counts = {};
  for (const table of COUNT_TABLES) {
    try {
      const rows = await sql(`select count(*)::int as count from public.${table}`);
      counts[table] = rows?.[0]?.count ?? null;
    } catch {
      counts[table] = null;
    }
  }
  return counts;
}

export default async function handler(req, res) {
  if (handleCorsPreflight(req, res)) return;
  applyCors(req, res);

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const result = {
    ok: true,
    mode: {
      dataBackend: process.env.VITE_DATA_BACKEND || "supabase",
      storage: process.env.STORAGE_PROVIDER || process.env.VITE_STORAGE_PROVIDER || "auto",
      auth: process.env.VITE_AUTH_PROVIDER || "auto",
      realtime: process.env.VITE_REALTIME_PROVIDER || "auto",
    },
    supabase: await supabasePing(),
    neon: { configured: isNeonConfigured() },
    redis: { configured: isRedisConfigured() },
    blob: { configured: isBlobConfigured() },
    clerk: { configured: Boolean(process.env.CLERK_SECRET_KEY) },
    ably: { configured: Boolean(process.env.ABLY_API_KEY) },
  };

  if (isNeonConfigured()) {
    try {
      const ping = await pingNeon();
      result.neon.ok = true;
      result.neon.serverTime = ping?.server_time ?? null;
      result.neon.counts = await neonCounts();
    } catch (error) {
      result.neon.ok = false;
      result.neon.error = error?.message || String(error);
      result.ok = false;
    }
  }

  if (isRedisConfigured()) {
    try {
      const redis = getRedis();
      const pong = await redis.ping();
      result.redis.ok = pong === "PONG" || pong === "pong" || pong === true;
    } catch (error) {
      result.redis.ok = false;
      result.redis.error = error?.message || String(error);
    }
  }

  return res.status(result.ok ? 200 : 503).json(result);
}
