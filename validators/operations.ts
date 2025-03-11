import { body } from "express-validator";
import type { RequestHandler } from "express";

const createLinkValidator: RequestHandler = async (req, _res, next) => {
  await body("from")
    .notEmpty()
    .withMessage("from not defined in body")
    .isURL()
    .withMessage("from must be a valid link")
    .run(req);
  await body("to")
    .notEmpty()
    .withMessage("to not defined in body")
    .isURL()
    .withMessage("to must be a valid link")
    .run(req);
  next();
};

export {
  createLinkValidator,
  createLinkValidator as removeLinkValidator,
  createLinkValidator as populateSingleLinkValidator,
  createLinkValidator as pruneSingleLinkValidator,
};
