require('dotenv').config();
const { createLogger, transports, config, format } = require('winston');
const { combine, timestamp, json } = format;

const logger = createLogger({
  levels: config.npm.levels,
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    json()
  ),
  transports: [
    process.env.NODE_ENV !== 'production' ?
      new transports.Console() :
      new transports.File({ filename: __dirname + '/../logs/common.log' }),
    new transports.File({ filename: __dirname + '/../logs/error.log', level: 'error' }),
  ]
});

module.exports = {
  logger
};