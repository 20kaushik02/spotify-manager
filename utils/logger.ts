import path from "path";

import { createLogger, transports, config, format, type Logger } from "winston";

const { combine, timestamp, printf, errors } = format;

const metaFormat = (meta: object) => {
  const disallowedKeySets = [{ type: Error, keys: ["stack"] }];
  if (Object.keys(meta).length > 0)
    return (
      "\n" +
      JSON.stringify(
        meta,
        Object.getOwnPropertyNames(meta).filter((key) => {
          for (const pair of disallowedKeySets) {
            if (meta instanceof pair.type) {
              return !pair.keys.includes(key);
            }
          }
          return true;
        }),
        "\t"
      )
    );
  return "";
};

const logFormat = printf(({ level, message, label, timestamp, ...meta }) => {
  const errorObj: Error = meta["error"] as Error;
  if (errorObj) {
    return (
      `${timestamp} [${level.toUpperCase()}]: ${message}${metaFormat(
        errorObj
      )}\n` + `${errorObj["stack"] ?? ""}`
    );
  }
  return `${timestamp} [${level.toUpperCase()}]: ${message}${metaFormat(meta)}`;
});

const winstonLogger: Logger = createLogger({
  levels: config.npm.levels,
  format: combine(
    errors({ stack: true }),
    timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    logFormat
  ),
  transports: [
    new transports.Console({ level: "info" }),
    new transports.File({
      filename: path.join(import.meta.dirname, "..", "logs", "debug.log"),
      level: "debug",
      maxsize: 10485760,
    }),
    new transports.File({
      filename: path.join(import.meta.dirname, "..", "logs", "error.log"),
      level: "error",
      maxsize: 1048576,
    }),
  ],
});
winstonLogger.on("error", (error) =>
  winstonLogger.error("Error inside logger", { error })
);

export default winstonLogger;
