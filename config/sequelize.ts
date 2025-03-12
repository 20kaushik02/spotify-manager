import type { SequelizeOptions } from "sequelize-typescript";

import logger from "../utils/logger.ts";

type ConnConfigs = Record<string, SequelizeOptions>;

// env-specific config
const connConfigs: ConnConfigs = {
  development: {},
  test: {},
  production: {
    // dialectOptions: {
    //   ssl: true,
    // },
  },
};

// common config
for (const conf in connConfigs) {
  connConfigs[conf]!.logging = (msg: any) => logger.debug(msg);
  connConfigs[conf]!.dialect = "postgres";
}

export default connConfigs;
