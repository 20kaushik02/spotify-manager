import { validationResult } from "express-validator";

import type { RequestHandler } from "express";

import { getNestedValuesString } from "../utils/jsonTransformer.ts";

import logger from "../utils/logger.ts";

const validate: RequestHandler = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return next();
  }

  const extractedErrors: Record<string, string>[] = [];
  errors.array().forEach((err) => {
    if (err.type === "alternative") {
      err.nestedErrors.forEach((nestedErr) => {
        extractedErrors.push({
          [nestedErr.path]: nestedErr.msg,
        });
      });
    } else if (err.type === "field") {
      extractedErrors.push({
        [err.path]: err.msg,
      });
    }
  });

  res.status(400).send({
    message: getNestedValuesString(extractedErrors),
    errors: extractedErrors,
  });
  logger.warn("invalid request", { extractedErrors });
  return;
};

export { validate };
