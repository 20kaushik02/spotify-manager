import _ from "./config/dotenv.ts";

import { promisify } from "util";
import express from "express";
import session from "express-session";

import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";

import { RedisStore } from "connect-redis";

import { redisClient } from "./config/redis.ts";

import { sessionName } from "./constants.ts";
import seqConn from "./models/index.ts";

import { isAuthenticated } from "./middleware/authCheck.ts";
import { getCurrentUsersProfile } from "./api/spotify.ts";

import authRoutes from "./routes/auth.ts";
import playlistRoutes from "./routes/playlists.ts";
import operationRoutes from "./routes/operations.ts";

import curriedLogger from "./utils/logger.ts";
const logger = curriedLogger(import.meta.filename);

const app = express();

// check env vars
if (
  isNaN(Number(process.env["TRUST_PROXY"])) ||
  ![0, 1].includes(Number(process.env["TRUST_PROXY"]))
) {
  throw new TypeError("TRUST_PROXY must be 0 or 1");
}
if (!process.env["SESSION_SECRET"]) {
  throw new TypeError("SESSION_SECRET cannot be undefined");
}

// Enable this if you run behind a proxy (e.g. nginx)
app.set("trust proxy", process.env["TRUST_PROXY"]);

const redisStore = new RedisStore({ client: redisClient });

// Configure session middleware
app.use(
  session({
    name: sessionName,
    store: redisStore,
    secret: process.env["SESSION_SECRET"],
    resave: false,
    saveUninitialized: false,
    cookie: {
      domain: process.env["BASE_DOMAIN"],
      httpOnly: true, // if true prevent client side JS from reading the cookie
      maxAge: 7 * 24 * 60 * 60 * 1000, // 1 week
      sameSite: process.env["NODE_ENV"] === "development" ? "lax" : "none", // cross-site for production
      secure: process.env["NODE_ENV"] === "development" ? false : true, // if true only transmit cookie over https
    },
  })
);

app.use(
  cors({
    origin: process.env["APP_URI"],
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
    const respData = await getCurrentUsersProfile({ req, res });
    if (!respData) return null;
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

const port = process.env["PORT"] || 5000;

const server = app.listen(port, () => {
  logger.info(`App Listening on port ${port}`);
});

const cleanupFunc = (signal?: string) => {
  if (signal) logger.debug(`${signal} signal received, shutting down now...`);

  Promise.allSettled([
    redisClient.disconnect,
    seqConn.close(),
    promisify(server.close),
  ]).then(() => {
    logger.info("Cleaned up, exiting.");
    process.exit(0);
  });
};

["SIGHUP", "SIGINT", "SIGQUIT", "SIGTERM", "SIGUSR1", "SIGUSR2"].forEach(
  (signal) => {
    process.on(signal, () => cleanupFunc(signal));
  }
);
