import type { RequestHandler } from "express";

import { sessionName } from "../constants.ts";

import logger from "../utils/logger.ts";

const isAuthenticated: RequestHandler = (req, res, next) => {
  if (req.session.accessToken) {
    req.session.authHeaders = {
      Authorization: `Bearer ${req.session.accessToken}`,
    };
    next();
  } else {
    const delSession = req.session.destroy((error) => {
      if (Object.keys(error).length) {
        res.status(500).send({ message: "Internal Server Error" });
        logger.error("session.destroy", { error });
        return;
      } else {
        res.clearCookie(sessionName);
        res.status(401).send({ message: "Unauthorized" });
        logger.debug("Session invalid, destroyed.", {
          sessionID: delSession.id,
        });
        return;
      }
    });
  }
};

export { isAuthenticated };
