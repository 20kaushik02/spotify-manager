import { authInstance } from "../api/axios.ts";
import { getCurrentUsersProfile } from "../api/spotify.ts";

import {
  requiredScopes,
  stateKey,
  accountsAPIURL,
  sessionName,
} from "../constants.ts";
import type { RequestHandler } from "express";

import { generateRandString } from "../utils/generateRandString.ts";

import logger from "../utils/logger.ts";

/**
 * Stateful redirect to Spotify login with credentials
 */
const login: RequestHandler = async (_req, res) => {
  try {
    const state = generateRandString(16);
    res.cookie(stateKey, state);

    res.redirect(
      `${accountsAPIURL}/authorize?` +
        new URLSearchParams({
          response_type: "code",
          client_id: process.env["SPOTMGR_CLIENT_ID"],
          scope: Object.values(requiredScopes).join(" "),
          redirect_uri: process.env["SPOTMGR_REDIRECT_URI"],
          state: state,
        } as Record<string, string>).toString()
    );
    return null;
  } catch (error) {
    res.status(500).send({ message: "Internal Server Error" });
    logger.error("login", { error });
    return null;
  }
};

/**
 * Exchange authorization code for refresh and access tokens
 */
const callback: RequestHandler = async (req, res) => {
  try {
    const { code, state, error } = req.query;
    const storedState = req.cookies ? req.cookies[stateKey] : null;
    let authHeaders;

    // check state
    if (state === null || state !== storedState) {
      res.status(409).send({ message: "Invalid state" });
      logger.warn("state mismatch");
      return null;
    } else if (error) {
      res.status(401).send({ message: "Auth callback error" });
      logger.error("callback error", { error });
      return null;
    } else {
      // get auth tokens
      res.clearCookie(stateKey);

      const authForm = {
        code: code,
        redirect_uri: process.env["SPOTMGR_REDIRECT_URI"],
        grant_type: "authorization_code",
      } as Record<string, string>;

      const authPayload = new URLSearchParams(authForm).toString();

      const tokenResponse = await authInstance.post("/api/token", authPayload);

      if (tokenResponse.status === 200) {
        logger.debug("Tokens obtained.");
        req.session.accessToken = tokenResponse.data.access_token;
        req.session.refreshToken = tokenResponse.data.refresh_token;
        authHeaders = {
          Authorization: `Bearer ${req.session.accessToken}`,
        };
      } else {
        res
          .status(tokenResponse.status)
          .send({ message: "Error: Login failed" });
        logger.error("login failed", { statusCode: tokenResponse.status });
        return null;
      }

      const { resp } = await getCurrentUsersProfile({
        res,
        authHeaders,
      });
      if (!resp) return null;

      req.session.user = {
        username: resp.data.display_name ?? "",
        id: resp.data.id,
      };

      // res.status(200).send({ message: "OK" });
      res.redirect(process.env["SPOTMGR_APP_URI"] + "?login=success");
      logger.debug("New login.", { username: resp.data.display_name });
      return null;
    }
  } catch (error) {
    res.status(500).send({ message: "Internal Server Error" });
    logger.error("callback", { error });
    return null;
  }
};

/**
 * Request new access token using refresh token
 */
const refresh: RequestHandler = async (req, res) => {
  try {
    const authForm = {
      refresh_token: req.session.refreshToken ?? "",
      grant_type: "refresh_token",
    };

    const authPayload = new URLSearchParams(authForm).toString();

    // TODO: types for this and other auth endpoints... but is it necessary?
    const response = await authInstance.post("/api/token", authPayload);

    if (response.status === 200) {
      req.session.accessToken = response.data.access_token;
      req.session.refreshToken =
        response.data.refresh_token ?? req.session.refreshToken; // refresh token rotation

      res.status(200).send({ message: "OK" });
      logger.debug(
        `Access token refreshed${
          response.data.refresh_token !== null
            ? " and refresh token updated"
            : ""
        }.`
      );
      return null;
    } else {
      res
        .status(response.status)
        .send({ message: "Error: Refresh token flow failed." });
      logger.error("refresh failed", {
        statusCode: response.status,
        data: response.data,
      });
      return null;
    }
  } catch (error) {
    res.status(500).send({ message: "Internal Server Error" });
    logger.error("refresh", { error });
    return null;
  }
};

/**
 * Clear session
 */
const logout: RequestHandler = async (req, res) => {
  try {
    const delSession = req.session.destroy((error) => {
      if (Object.keys(error).length) {
        res.status(500).send({ message: "Internal Server Error" });
        logger.error("Error while logging out", { error });
      } else {
        res.clearCookie(sessionName);
        // res.status(200).send({ message: "OK" });
        res.redirect(process.env["SPOTMGR_APP_URI"] + "?logout=success");
        logger.debug("Logged out.", { sessionID: delSession.id });
      }
    });
    return null;
  } catch (error) {
    res.status(500).send({ message: "Internal Server Error" });
    logger.error("logout", { error });
    return null;
  }
};

export { login, callback, refresh, logout };
