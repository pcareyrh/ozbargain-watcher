import { Redis } from "@upstash/redis";

let redis: Redis | null | undefined;

export function isRedisConfigured(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
  );
}

export function getRedis(): Redis | null {
  if (redis !== undefined) return redis;

  if (!isRedisConfigured()) {
    redis = null;
    return redis;
  }

  redis = Redis.fromEnv();
  return redis;
}
