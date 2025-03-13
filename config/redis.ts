import { createClient } from "redis";

import logger from "../utils/logger.ts";

if (!process.env["REDIS_URI"])
  throw new TypeError("Redis connection URI not defined");

// Initialize
const redisClient: ReturnType<typeof createClient> = createClient({
  url: process.env["REDIS_URI"],
  socket: {
    keepAlive: 25 * 1000, // 25s
  },
});
redisClient.on("error", (error) => {
  logger.error("redisClient", { error });
  throw error;
});

await redisClient.connect();
logger.info("Connected to Redis store");

export { redisClient };
