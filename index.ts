import { promisify } from "util";
import express from "express";
import session from "express-session";

import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";

import { RedisStore } from "connect-redis";

import { redisClient } from "./config/redis.ts";

import { sessionName } from "./constants.ts";

import { isAuthenticated } from "./middleware/authCheck.ts";
import { getCurrentUsersProfile } from "./api/spotify.ts";

import authRoutes from "./routes/auth.ts";
import playlistRoutes from "./routes/playlists.ts";
import operationRoutes from "./routes/operations.ts";
import loadRoutes from "./routes/load.ts";

import logger from "./utils/logger.ts";

const app = express();

// check env vars
const trustProxySetting = Number(process.env["SPOTMGR_TRUST_PROXY"]);
if (isNaN(trustProxySetting)) {
  throw new TypeError("SPOTMGR_TRUST_PROXY must be a number");
}
if (!process.env["SPOTMGR_SESSION_SECRET"]) {
  throw new TypeError("SPOTMGR_SESSION_SECRET cannot be undefined");
}

// Enable this if you run behind a proxy (e.g. nginx)
app.set("trust proxy", trustProxySetting);

const redisStore = new RedisStore({ client: redisClient });

// Configure session middleware
app.use(
  session({
    name: sessionName,
    store: redisStore,
    secret: process.env["SPOTMGR_SESSION_SECRET"],
    resave: false,
    saveUninitialized: false,
    cookie: {
      domain: process.env["SPOTMGR_BASE_DOMAIN"],
      httpOnly: true, // if true prevent client side JS from reading the cookie
      maxAge: 7 * 24 * 60 * 60 * 1000, // 1 week
      sameSite: process.env["NODE_ENV"] === "development" ? "lax" : "none", // cross-site for production
      secure: process.env["NODE_ENV"] === "development" ? false : true, // if true only transmit cookie over https
    },
  })
);

app.use(
  cors({
    origin: process.env["SPOTMGR_APP_URI"],
    credentials: true,
  })
);
app.use(
  helmet({
    crossOriginOpenerPolicy: {
      policy:
        process.env["NODE_ENV"] === "development"
          ? "unsafe-none"
          : "same-origin",
    },
  })
);
app.disable("x-powered-by");

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static
app.use(express.static(import.meta.dirname + "/static"));

// Healthcheck
app.use("/health", (_req, res) => {
  res.status(200).send({ message: "OK" });
  return null;
});
app.use("/auth-health", isAuthenticated, async (req, res) => {
  try {
    const { authHeaders } = req.session;
    if (!authHeaders)
      throw new ReferenceError("session does not have auth headers");
    const { resp } = await getCurrentUsersProfile({ authHeaders, res });
    if (!resp) return null;
    res.status(200).send({ message: "OK" });
    return null;
  } catch (error) {
    res.status(500).send({ message: "Internal Server Error" });
    logger.error("authHealthCheck", { error });
    return null;
  }
});

// Routes
app.use("/api/auth/", authRoutes);
app.use("/api/playlists", isAuthenticated, playlistRoutes);
app.use("/api/operations", isAuthenticated, operationRoutes);
app.use("/api/load", isAuthenticated, loadRoutes);

// Fallbacks
app.use((req, res) => {
  res
    .status(404)
    .send(
      'Guess the <a href="https://github.com/20kaushik02/spotify-manager">cat\'s</a> out of the bag!'
    );
  logger.info("404", { url: req.url });
  return null;
});

const port = process.env["SPOTMGR_PORT"] || 5000;

const server = app.listen(port, () => {
  logger.info(`App Listening on port ${port}`);
});

const cleanupFunc = (signal?: string) => {
  if (signal) logger.debug(`${signal} signal received, shutting down now...`);

  Promise.allSettled([promisify(server.close)]).then(() => {
    logger.info("Cleaned up, exiting.");
    process.exit(0);
  });
};

["SIGHUP", "SIGINT", "SIGQUIT", "SIGTERM", "SIGUSR1", "SIGUSR2"].forEach(
  (signal) => {
    process.on(signal, () => cleanupFunc(signal));
  }
);
