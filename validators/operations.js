import { body, header, param, query } from "express-validator";
import * as typedefs from "../typedefs.js";

/**
 * @param {typedefs.Req} req
 * @param {typedefs.Res} res
 * @param {typedefs.Next} next
 */
export const createLinkValidator = async (req, res, next) => {
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
}

export { createLinkValidator as removeLinkValidator };
export { createLinkValidator as populateSingleLinkValidator };
export { createLinkValidator as pruneSingleLinkValidator };
