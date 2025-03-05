import { body, header, param, query } from "express-validator";

import * as typedefs from "../typedefs.js";

/**
 * @param {typedefs.Req} req
 * @param {typedefs.Res} res
 * @param {typedefs.Next} next
 */
export const __validator_func = async (req, res, next) => {
  await body("field_name")
    .notEmpty()
    .withMessage("field_name not defined in body")
    .run(req);

  next();
}
