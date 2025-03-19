"use strict";
import { Sequelize } from "sequelize-typescript";

import seqConfig from "../config/sequelize.ts";

import links from "./links.ts";
import playlists from "./playlists.ts";

import logger from "../utils/logger.ts";

// Initialize
if (!process.env["NODE_ENV"])
  throw new TypeError("Node environment not defined");
const config = seqConfig[process.env["NODE_ENV"]];
if (!config) throw new TypeError("Unknown environment");

const dbURI = process.env[config.use_env_variable];
if (!dbURI) throw new TypeError("Database connection URI not defined");

const seqConn: Sequelize = new Sequelize(dbURI, config);

try {
  await seqConn.authenticate();
  logger.info("Sequelize auth success");
} catch (error) {
  logger.error("Sequelize auth error", { error });
  throw error;
}

// Load models
seqConn.addModels([links, playlists]);

export default seqConn;
