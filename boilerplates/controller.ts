import type { RequestHandler } from "express";

import curriedLogger from "../utils/logger.ts";
const logger = curriedLogger(import.meta.filename);

const __controller_func: RequestHandler = async (req, res) => {
  try {
    return null;
  } catch (error) {
    res.status(500).send({ message: "Internal Server Error" });
    logger.error("__controller_func", { error });
    return null;
  }
};

export { __controller_func };
