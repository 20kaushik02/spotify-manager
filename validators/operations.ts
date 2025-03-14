import { body } from "express-validator";
import type { RequestHandler } from "express";

const linkValidator: RequestHandler = async (req, _res, next) => {
  await body("from")
    .notEmpty()
    .withMessage("from not defined in body")
    .isURL()
    .withMessage("from must be a valid playlist link")
    .run(req);
  await body("to")
    .notEmpty()
    .withMessage("to not defined in body")
    .isURL()
    .withMessage("to must be a valid playlist link")
    .run(req);
  next();
};

const nodeValidator: RequestHandler = async (req, _res, next) => {
  await body("root")
    .notEmpty()
    .withMessage("root not defined in body")
    .isURL()
    .withMessage("root must be a valid playlist link")
    .run(req);
  next();
};

export { linkValidator, nodeValidator };
