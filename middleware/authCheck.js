const { sessionName } = require("../constants");
const typedefs = require("../typedefs");
const logger = require("../utils/logger")(module);

/**
 * middleware to check if access token is present
 * @param {typedefs.Req} req
 * @param {typedefs.Res} res
 * @param {typedefs.Next} next
 */
const isAuthenticated = (req, res, next) => {
  if (req.session.accessToken) {
    req.sessHeaders = {
      "Authorization": `Bearer ${req.session.accessToken}`,
      // "X-RateLimit-SessID": `${req.sessionID}_${req.session.user.username}`
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
        logger.debug("Session invalid, destroyed.", { sessionID: delSession.id });
        return;
      }
    });
  }
}

module.exports = {
  isAuthenticated,
}
