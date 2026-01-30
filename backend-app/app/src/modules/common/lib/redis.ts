import Redis from "ioredis"

/**
 * Shared Redis client for the application.
 * Reuse this single instance everywhere (recommended by Redis/ioredis docs).
 * TLS is used only when REDIS_URL starts with rediss:// (e.g. Redis Cloud).
 * Use redis:// for plain TCP (e.g. localhost) to avoid "packet length too long" SSL errors.
 * @see https://redis.io/docs/latest/develop/clients/ioredis/
 * @see https://github.com/redis/ioredis
 */
const redisUrl = process.env.REDIS_URL ?? ""
const useTls = redisUrl.startsWith("rediss://")
const tlsRejectUnauthorized =
  process.env.REDIS_TLS_REJECT_UNAUTHORIZED === "false" ||
  process.env.REDIS_TLS_REJECT_UNAUTHORIZED === "0"

export const redis = new Redis(redisUrl, {
  tls: useTls ? { rejectUnauthorized: !tlsRejectUnauthorized } : undefined,
})

redis.on("error", (err) => {
  console.warn("[Redis] connection error (cache will fall back to Mongo/Qdrant):", err.message)
})
