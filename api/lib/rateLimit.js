const buckets = new Map();

function prune(key, windowMs) {
  const now = Date.now();
  const entries = buckets.get(key) ?? [];
  const fresh = entries.filter((ts) => now - ts < windowMs);
  if (fresh.length) buckets.set(key, fresh);
  else buckets.delete(key);
  return fresh;
}

/**
 * Simple in-memory sliding-window rate limiter for serverless handlers.
 * @returns {{ allowed: boolean, retryAfterSec?: number }}
 */
export function checkRateLimit(key, { limit = 30, windowMs = 60_000 } = {}) {
  const now = Date.now();
  const entries = prune(key, windowMs);
  if (entries.length >= limit) {
    const oldest = entries[0];
    const retryAfterSec = Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000));
    return { allowed: false, retryAfterSec };
  }
  entries.push(now);
  buckets.set(key, entries);
  return { allowed: true };
}

export function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket?.remoteAddress || "unknown";
}

export function applyRateLimit(req, res, key, options) {
  const result = checkRateLimit(key, options);
  if (!result.allowed) {
    res.setHeader("Retry-After", String(result.retryAfterSec));
    res.status(429).json({ error: "Too many requests. Please slow down." });
    return false;
  }
  return true;
}
