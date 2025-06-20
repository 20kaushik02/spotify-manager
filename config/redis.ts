import { createClient } from "redis";

import logger from "../utils/logger.ts";

if (!process.env["SPOTMGR_REDIS_URI"])
  throw new TypeError("Redis connection URI not defined");

// Initialize
const redisClient: ReturnType<typeof createClient> = createClient({
  url: process.env["SPOTMGR_REDIS_URI"],
  socket: {
    keepAlive: true,
    keepAliveInitialDelay: 25 * 1000, // 25s
    connectTimeout: 15 * 1000,
  },
});
redisClient.on("error", (error) => {
  logger.error("redisClient", { error });
  throw error;
});

await redisClient.connect();
logger.info("Connected to Redis store");

export { redisClient };
