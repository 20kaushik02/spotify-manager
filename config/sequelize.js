const logger = require("../utils/logger")(module);

let connConfigs = {
	development: {
		username: process.env.PG_USER,
		password: process.env.PG_PASSWD,
		database: process.env.PG_DATABASE,
		host: process.env.PG_HOST,
		port: process.env.PG_PORT,
	},
	test: {
		username: process.env.PG_USER,
		password: process.env.PG_PASSWD,
		database: process.env.PG_DATABASE,
		host: process.env.PG_HOST,
		port: process.env.PG_PORT,
	},
	production: {
		username: process.env.PG_USER,
		password: process.env.PG_PASSWD,
		database: process.env.PG_DATABASE,
		host: process.env.PG_HOST,
		port: process.env.PG_PORT,
	},
}

// common config
for (const conf in connConfigs) {
	connConfigs[conf]['logging'] = (msg) => logger.debug(msg);
	connConfigs[conf]['dialect'] = 'postgres';
}

module.exports = connConfigs;