import type { AxiosRequestHeaders } from "axios";
import type { RequestHandler } from "express";

import { sessionName } from "../constants.ts";

import curriedLogger from "../utils/logger.ts";
const logger = curriedLogger(import.meta.filename);

export const isAuthenticated: RequestHandler = (req, res, next) => {
  if (req.session.accessToken) {
    req.session.authHeaders = {
      Authorization: `Bearer ${req.session.accessToken}`,
    } as AxiosRequestHeaders;
    next();
  } else {
    const delSession = req.session.destroy((error) => {
      if (Object.keys(error).length) {
        res.status(500).send({ message: "Internal Server Error" });
        logger.error("session.destroy", { error });
        return null;
      } else {
        res.clearCookie(sessionName);
        res.status(401).send({ message: "Unauthorized" });
        logger.debug("Session invalid, destroyed.", {
          sessionID: delSession.id,
        });
        return null;
      }
    });
  }
};
