import path from "path";

import { createLogger, transports, config, format, type Logger } from "winston";

const { combine, timestamp, printf } = format;

const metaFormat = (meta: object) => {
  if (Object.keys(meta).length > 0)
    return "\n" + JSON.stringify(meta, null, "\t");
  return "";
};

const logFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  const errorObj: Error = meta["error"] as Error;
  if (errorObj) {
    const stackStr = errorObj["stack"];
    return (
      `${timestamp} [${level.toUpperCase()}]: ${message}` + // line 1
      `${metaFormat(errorObj)}\n` + // metadata
      `${stackStr}` // stack trace if any
    );
  }
  return `${timestamp} [${level.toUpperCase()}]: ${message}${metaFormat(meta)}`;
});

const winstonLogger: Logger = createLogger({
  levels: config.npm.levels,
  format: combine(timestamp({ format: "YYYY-MM-DD HH:mm:ss" }), logFormat),
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
    }),
  ],
});
winstonLogger.on("error", (error) =>
  console.error("Error inside logger", error)
);
winstonLogger.exceptions.handle(
  new transports.File({
    filename: path.join(import.meta.dirname, "..", "logs", "exceptions.log"),
  })
);

export default winstonLogger;
