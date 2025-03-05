import curriedLogger from "../utils/logger.js";
const logger = curriedLogger(import.meta);

import * as typedefs from "../typedefs.js";

/**
 * @param {typedefs.Req} req
 * @param {typedefs.Res} res
 */
export const __controller_func = async (req, res) => {
  try {

  } catch (error) {
    res.status(500).send({ message: "Internal Server Error" });
    logger.error("__controller_func", { error });
    return;
  }
}
