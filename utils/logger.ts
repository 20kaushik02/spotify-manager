import path from "path";

import { createLogger, transports, config, format, type Logger } from "winston";

const { combine, label, timestamp, printf, errors } = format;

const getLabel = (callingModuleName: string) => {
  if (!callingModuleName) return "repl";
  const parts = callingModuleName.split(path.sep);
  return path.join(
    parts[parts.length - 2] ?? "",
    parts[parts.length - 1] ?? ""
  );
};

const allowedErrorKeys = ["name", "code", "message", "stack"];

const metaFormat = (meta: Record<string, unknown>) => {
  if (Object.keys(meta).length > 0)
    return "\n" + JSON.stringify(meta, null, "\t");
  return "";
};

const logFormat = printf(({ level, message, label, timestamp, ...meta }) => {
  if (meta["error"]) {
    const sanitizedError = Object.fromEntries(
      Object.entries(meta["error"]).filter(([key]) =>
        allowedErrorKeys.includes(key)
      )
    );

    const { stack, ...rest } = sanitizedError;
    return (
      `${timestamp} [${label}] ${level}: ${message}${metaFormat(rest)}\n` +
      `${stack ?? ""}`
    );
  }
  return `${timestamp} [${label}] ${level}: ${message}${metaFormat(meta)}`;
});

const loggerCache = new Map<string, ReturnType<typeof createLogger>>();

const curriedLogger = (callingModuleName: string): Logger => {
  if (loggerCache.has(callingModuleName)) {
    return loggerCache.get(callingModuleName)!;
  }
  const winstonLogger = createLogger({
    levels: config.npm.levels,
    format: combine(
      errors({ stack: true }),
      label({ label: getLabel(callingModuleName) }),
      timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
      logFormat
    ),
    transports: [
      new transports.Console({ level: "info" }),
      new transports.File({
        filename: import.meta.dirname + "/../logs/debug.log",
        level: "debug",
        maxsize: 10485760,
      }),
      new transports.File({
        filename: import.meta.dirname + "/../logs/error.log",
        level: "error",
        maxsize: 1048576,
      }),
    ],
  });
  winstonLogger.on("error", (error) =>
    winstonLogger.error("Error inside logger", { error })
  );
  loggerCache.set(callingModuleName, winstonLogger);
  return winstonLogger;
};

export default curriedLogger;
