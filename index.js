import _ from "./config/dotenv.js";

import { promisify } from "util";
import express from "express";
import session from "express-session";

import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";

import { createClient } from 'redis';
import { RedisStore } from "connect-redis";

import { sessionName } from "./constants.js";
import { sequelize } from "./models/index.js";

import { isAuthenticated } from "./middleware/authCheck.js";
import { getUserProfile } from "./api/spotify.js";

import curriedLogger from "./utils/logger.js";
const logger = curriedLogger(import.meta);

const app = express();

// Enable this if you run behind a proxy (e.g. nginx)
app.set("trust proxy", process.env.TRUST_PROXY);

// Configure Redis client and connect
const redisClient = createClient({
  socket: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
  }
});

redisClient.connect()
  .then(() => {
    logger.info("Connected to Redis store");
  })
  .catch((error) => {
    logger.error("Redis connection error", { error });
    cleanupFunc();
  });

const redisStore = new RedisStore({ client: redisClient });

// Configure session middleware
app.use(session({
  name: sessionName,
  store: redisStore,
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    domain: process.env.BASE_DOMAIN,
    httpOnly: true, // if true prevent client side JS from reading the cookie
    maxAge: 7 * 24 * 60 * 60 * 1000, // 1 week
    sameSite: process.env.NODE_ENV === "development" ? "lax" : "none", // cross-site for production
    secure: process.env.NODE_ENV === "development" ? false : true, // if true only transmit cookie over https
  }
}));

app.use(cors({
  origin: process.env.APP_URI,
  credentials: true
}));
app.use(helmet({
  crossOriginOpenerPolicy: { policy: process.env.NODE_ENV === "development" ? "unsafe-none" : "same-origin" }
}));
app.disable("x-powered-by");

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static
app.use(express.static(import.meta.dirname + "/static"));

// Healthcheck
app.use("/health", (req, res) => {
  res.status(200).send({ message: "OK" });
  return;
});
app.use("/auth-health", isAuthenticated, async (req, res) => {
  try {
    await getUserProfile(req, res);
    if (res.headersSent) return;
    res.status(200).send({ message: "OK" });
    return;
  } catch (error) {
    res.status(500).send({ message: "Internal Server Error" });
    logger.error("authHealthCheck", { error });
    return;
  }
});
import authRoutes from "./routes/auth.js";
import playlistRoutes from "./routes/playlists.js";
import operationRoutes from "./routes/operations.js";
// Routes
app.use("/api/auth/", authRoutes);
app.use("/api/playlists", isAuthenticated, playlistRoutes);
app.use("/api/operations", isAuthenticated, operationRoutes);

// Fallbacks
app.use((req, res) => {
  res.status(404).send(
    "Guess the <a href=\"https://github.com/20kaushik02/spotify-manager\">cat's</a> out of the bag!"
  );
  logger.info("404", { url: req.url });
  return;
});

const port = process.env.PORT || 5000;

const server = app.listen(port, () => {
  logger.info(`App Listening on port ${port}`);
});

const cleanupFunc = (signal) => {
  if (signal)
    logger.debug(`${signal} signal received, shutting down now...`);

  Promise.allSettled([
    redisClient.disconnect,
    sequelize.close(),
    promisify(server.close),
  ]).then(() => {
    logger.info("Cleaned up, exiting.");
    process.exit(0);
  });
}

["SIGHUP", "SIGINT", "SIGQUIT", "SIGTERM", "SIGUSR1", "SIGUSR2"].forEach((signal) => {
  process.on(signal, () => cleanupFunc(signal));
});
