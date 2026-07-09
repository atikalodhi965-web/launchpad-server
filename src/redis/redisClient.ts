import { createClient, RedisClientType } from "redis";

const REDIS_URL = process.env.REDIS_URL || "redis://default:5RD0JQQ2ltHDZf8ypzyvJ8IGAjP1xJFw@redis-15961.c340.ap-northeast-2-1.ec2.redns.redis-cloud.com:15961";

export const redisClient: RedisClientType = createClient({
    url: REDIS_URL,
});

redisClient.on("error", (err) => {
    console.error("❌ Redis error:", err);
});
redisClient.on("connect", () => {
    console.log("✅ Redis connected");
});

export async function connectRedis() {
    if (!redisClient.isOpen) {
        await redisClient.connect();
    }
}

// ✅ New function for graceful shutdown
export async function disconnectRedis() {
  if (redisClient.isOpen) {
    await redisClient.quit();
    console.log("✅ Redis connection closed");
  }
}