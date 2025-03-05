import curriedLogger from "../utils/logger.js";
const logger = curriedLogger(import.meta);

const connConfigs = {
  development: {
    username: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWD || "",
    database: process.env.DB_NAME || "postgres",
    host: process.env.DB_HOST || "127.0.0.1",
    port: process.env.DB_PORT || 5432,
  },
  test: {
    use_env_variable: "DB_URL", // use connection string for non-dev env
  },
  production: {
    use_env_variable: "DB_URL", // use connection string for non-dev env
    // dialectOptions: {
    //   ssl: true,
    // },
  }
}

// common config
for (const conf in connConfigs) {
  connConfigs[conf]["logging"] = (msg) => logger.debug(msg);
  connConfigs[conf]["dialect"] = process.env.DB_DIALECT || "postgres";
}

export default connConfigs;
