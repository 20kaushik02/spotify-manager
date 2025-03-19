import type { SequelizeOptions } from "sequelize-typescript";

import logger from "../utils/logger.ts";

interface SeqOptsWithURI extends SequelizeOptions {
  use_env_variable: string;
}
type ConnConfigs = Record<string, SeqOptsWithURI>;

// env-specific config
const connConfigs: ConnConfigs = {
  development: {
    use_env_variable: "DB_URI",
  },
  test: {
    use_env_variable: "DB_URI",
  },
  production: {
    use_env_variable: "DB_URI",
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
