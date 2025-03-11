import type { RequestHandler } from "express";
import { body, header, param, query } from "express-validator";

const __validator_func: RequestHandler = async (req, _res, next) => {
  await body("field_name")
    .notEmpty()
    .withMessage("field_name not defined in body")
    .run(req);

  next();
};

export { __validator_func };
