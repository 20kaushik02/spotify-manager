const { authInstance } = require("../api/axios");

const typedefs = require("../typedefs");
const { scopes, stateKey, accountsAPIURL, sessionName } = require("../constants");

const generateRandString = require("../utils/generateRandString");
const { getUserProfile } = require("../api/spotify");
const logger = require("../utils/logger")(module);

/**
 * Stateful redirect to Spotify login with credentials
 * @param {typedefs.Req} req
 * @param {typedefs.Res} res
 */
const login = (_req, res) => {
  try {
    const state = generateRandString(16);
    res.cookie(stateKey, state);

    const scope = Object.values(scopes).join(" ");
    res.redirect(
      `${accountsAPIURL}/authorize?` +
      new URLSearchParams({
        response_type: "code",
        client_id: process.env.CLIENT_ID,
        scope: scope,
        redirect_uri: process.env.REDIRECT_URI,
        state: state
      }).toString()
    );
    return;
  } catch (error) {
    res.status(500).send({ message: "Internal Server Error" });
    logger.error("login", { error });
    return;
  }
}

/**
 * Exchange authorization code for refresh and access tokens
 * @param {typedefs.Req} req
 * @param {typedefs.Res} res
 */
const callback = async (req, res) => {
  try {
    const { code, state, error } = req.query;
    const storedState = req.cookies ? req.cookies[stateKey] : null;

    // check state
    if (state === null || state !== storedState) {
      res.status(409).send({ message: "Invalid state" });
      logger.warn("state mismatch");
      return;
    } else if (error) {
      res.status(401).send({ message: "Auth callback error" });
      logger.error("callback error", { error });
      return;
    } else {
      // get auth tokens
      res.clearCookie(stateKey);

      const authForm = {
        code: code,
        redirect_uri: process.env.REDIRECT_URI,
        grant_type: "authorization_code"
      }

      const authPayload = (new URLSearchParams(authForm)).toString();

      const tokenResponse = await authInstance.post("/api/token", authPayload);

      if (tokenResponse.status === 200) {
        logger.debug("Tokens obtained.");
        req.session.accessToken = tokenResponse.data.access_token;
        req.session.refreshToken = tokenResponse.data.refresh_token;
      } else {
        logger.error("login failed", { statusCode: tokenResponse.status });
        res.status(tokenResponse.status).send({ message: "Error: Login failed" });
      }

      const userData = await getUserProfile(req, res);
      if (res.headersSent) return;

      /** @type {typedefs.User} */
      req.session.user = {
        username: userData.display_name,
        id: userData.id,
      };

      // res.status(200).send({ message: "OK" });
      res.redirect(process.env.APP_URI + "?login=success");
      logger.debug("New login.", { username: userData.display_name });
      return;
    }
  } catch (error) {
    res.status(500).send({ message: "Internal Server Error" });
    logger.error("callback", { error });
    return;
  }
}

/**
 * Request new access token using refresh token
 * @param {typedefs.Req} req
 * @param {typedefs.Res} res
 */
const refresh = async (req, res) => {
  try {
    const authForm = {
      refresh_token: req.session.refreshToken,
      grant_type: "refresh_token",
    }

    const authPayload = (new URLSearchParams(authForm)).toString();

    const response = await authInstance.post("/api/token", authPayload);

    if (response.status === 200) {
      req.session.accessToken = response.data.access_token;
      req.session.refreshToken = response.data.refresh_token ?? req.session.refreshToken; // refresh token rotation

      res.status(200).send({ message: "OK" });
      logger.debug(`Access token refreshed${(response.data.refresh_token !== null) ? " and refresh token updated" : ""}.`);
      return;
    } else {
      res.status(response.status).send({ message: "Error: Refresh token flow failed." });
      logger.error("refresh failed", { statusCode: response.status });
      return;
    }
  } catch (error) {
    res.status(500).send({ message: "Internal Server Error" });
    logger.error("refresh", { error });
    return;
  }
};

/**
 * Clear session
 * @param {typedefs.Req} req
 * @param {typedefs.Res} res
 */
const logout = async (req, res) => {
  try {
    const delSession = req.session.destroy((error) => {
      if (error) {
        res.status(500).send({ message: "Internal Server Error" });
        logger.error("Error while logging out", { error });
        return;
      } else {
        res.clearCookie(sessionName);
        // res.status(200).send({ message: "OK" });
        res.redirect(process.env.APP_URI + "?logout=success");
        logger.debug("Logged out.", { sessionID: delSession.id });
        return;
      }
    })
  } catch (error) {
    res.status(500).send({ message: "Internal Server Error" });
    logger.error("logout", { error });
    return;
  }
}

module.exports = {
  login,
  callback,
  refresh,
  logout
};
