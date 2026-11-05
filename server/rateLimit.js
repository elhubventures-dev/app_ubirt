import { getRedis, isRedisConfigured } from "./redis.js";

const memoryBuckets = new Map();

function pruneMemory(key, windowMs) {
  const now = Date.now();
  const entries = memoryBuckets.get(key) ?? [];
  const fresh = entries.filter((ts) => now - ts < windowMs);
  if (fresh.length) memoryBuckets.set(key, fresh);
  else memoryBuckets.delete(key);
  return fresh;
}

function checkRateLimitMemory(key, { limit = 30, windowMs = 60_000 } = {}) {
  const now = Date.now();
  const entries = pruneMemory(key, windowMs);
  if (entries.length >= limit) {
    const oldest = entries[0];
    const retryAfterSec = Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000));
    return { allowed: false, retryAfterSec };
  }
  entries.push(now);
  memoryBuckets.set(key, entries);
  return { allowed: true };
}

/**
 * Sliding-window rate limit via Upstash Redis when configured; otherwise in-memory.
 * Prefer Redis on Vercel so limits are shared across serverless instances.
 * @returns {Promise<{ allowed: boolean, retryAfterSec?: number, backend: "redis" | "memory" }>}
 */
export async function checkRateLimit(key, { limit = 30, windowMs = 60_000 } = {}) {
  const preferMemory = process.env.RATE_LIMIT_BACKEND === "memory";
  const redis = !preferMemory && isRedisConfigured() ? getRedis() : null;

  if (!redis) {
    return { ...checkRateLimitMemory(key, { limit, windowMs }), backend: "memory" };
  }

  const redisKey = `rl:${key}`;
  const now = Date.now();
  const windowStart = now - windowMs;

  try {
    const pipeline = redis.pipeline();
    pipeline.zremrangebyscore(redisKey, 0, windowStart);
    pipeline.zadd(redisKey, { score: now, member: `${now}:${Math.random().toString(36).slice(2, 10)}` });
    pipeline.zcard(redisKey);
    pipeline.pexpire(redisKey, windowMs);
    const results = await pipeline.exec();
    const count = Number(results?.[2] ?? 0);

    if (count > limit) {
      const oldest = await redis.zrange(redisKey, 0, 0, { withScores: true });
      const oldestScore = Array.isArray(oldest) && oldest.length >= 2 ? Number(oldest[1]) : now;
      const retryAfterSec = Math.max(1, Math.ceil((windowMs - (now - oldestScore)) / 1000));
      return { allowed: false, retryAfterSec, backend: "redis" };
    }

    return { allowed: true, backend: "redis" };
  } catch (error) {
    console.warn("Redis rate limit failed; falling back to memory:", error?.message || error);
    return { ...checkRateLimitMemory(key, { limit, windowMs }), backend: "memory" };
  }
}

export function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket?.remoteAddress || "unknown";
}

/**
 * Apply rate limit to a serverless handler. Async — always await.
 * @returns {Promise<boolean>} true if request may proceed
 */
export async function applyRateLimit(req, res, key, options) {
  const result = await checkRateLimit(key, options);
  if (!result.allowed) {
    res.setHeader("Retry-After", String(result.retryAfterSec));
    res.status(429).json({ error: "Too many requests. Please slow down." });
    return false;
  }
  return true;
}
