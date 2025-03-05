"use strict";
import { readdirSync } from "fs";
import { basename as _basename } from "path";
const basename = _basename(import.meta.filename);

import Sequelize from "sequelize";

import curriedLogger from "../utils/logger.js";
const logger = curriedLogger(import.meta);

import seqConfig from "../config/sequelize.js"
const env = process.env.NODE_ENV || "development";
const config = seqConfig[env];
const db = {};

let sequelize;
if (config.use_env_variable) {
  sequelize = new Sequelize(process.env[config.use_env_variable], config);
} else {
  sequelize = new Sequelize(config.database, config.username, config.password, config);
}

(async () => {
  try {
    await sequelize.authenticate();
    logger.debug("Sequelize auth success");
  } catch (error) {
    logger.error("Sequelize auth error", { error });
    throw error;
  }
})();

// Read model definitions from folder
const modelFiles = readdirSync(import.meta.dirname)
  .filter(
    (file) => file.indexOf('.') !== 0
      && file !== basename
      && file.slice(-3) === '.js',
  );

await Promise.all(modelFiles.map(async file => {
  const model = await import(`./${file}`);
  if (!model.default) {
    return;
  }

  const namedModel = model.default(sequelize, Sequelize.DataTypes);
  db[namedModel.name] = namedModel;
}))

// Setup defined associations
Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

// clean ts up
db.sequelize = sequelize;
db.Sequelize = Sequelize;
export { sequelize as sequelize };
export { Sequelize as Sequelize };
export default db;
