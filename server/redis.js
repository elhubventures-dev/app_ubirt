import { Redis } from "@upstash/redis";

let redis = null;

function getRedisRestConfig() {
  const url =
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.KV_REST_API_URL ||
    "";
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.KV_REST_API_TOKEN ||
    "";
  return { url, token };
}

/**
 * @returns {import("@upstash/redis").Redis | null}
 */
export function getRedis() {
  const { url, token } = getRedisRestConfig();
  if (!url || !token) return null;
  if (!redis) {
    redis = new Redis({ url, token });
  }
  return redis;
}

export function isRedisConfigured() {
  const { url, token } = getRedisRestConfig();
  return Boolean(url && token);
}
