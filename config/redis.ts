import { createClient } from "redis";

import { sleep } from "../utils/flake.ts";
import curriedLogger from "../utils/logger.ts";
const logger = curriedLogger(import.meta.filename);

if (!process.env["REDIS_URI"])
  throw new TypeError("Redis connection URI not defined");

// Initialize
const redisClient: ReturnType<typeof createClient> = createClient({
  url: process.env["REDIS_URI"],
});

// Check connection
(async () => {
  try {
    await redisClient.connect();
    while (!redisClient.isReady) await sleep(100);
    logger.info("Connected to Redis store");
  } catch (error) {
    logger.error("Redis connection error", { error });
    throw error;
  }
})();

export { redisClient };
