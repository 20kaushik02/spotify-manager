"use strict";
import { Sequelize } from "sequelize-typescript";

import seqConfig from "../config/sequelize.ts";

import links from "./links.ts";
import playlists from "./playlists.ts";

import logger from "../utils/logger.ts";

if (!process.env["NODE_ENV"])
  throw new TypeError("Node environment not defined");
if (!process.env["DB_URI"])
  throw new TypeError("Database connection URI not defined");

// Initialize
const config = seqConfig[process.env["NODE_ENV"]];
const seqConn: Sequelize = new Sequelize(process.env["DB_URI"], config);

// Check connection
(async () => {
  try {
    await seqConn.authenticate();
    logger.info("Sequelize auth success");
  } catch (error) {
    logger.error("Sequelize auth error", { error });
    throw error;
  }
})();

// Load models
seqConn.addModels([links, playlists]);

export default seqConn;
