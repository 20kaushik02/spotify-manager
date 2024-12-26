const path = require("path");

const { createLogger, transports, config, format } = require("winston");
const { combine, label, timestamp, printf, errors } = format;

const typedefs = require("../typedefs");

const getLabel = (callingModule) => {
    if (!callingModule.filename) return "repl";
    const parts = callingModule.filename?.split(path.sep);
    return path.join(parts[parts.length - 2], parts.pop());
};

const allowedErrorKeys = ["name", "code", "message", "stack"];

const metaFormat = (meta) => {
    if (Object.keys(meta).length > 0)
        return "\n" + JSON.stringify(meta, null, "\t");
    return "";
}

const logFormat = printf(({ level, message, label, timestamp, ...meta }) => {
    if (meta.error) { // if the error was passed
        for (const key in meta.error) {
            if (!allowedErrorKeys.includes(key)) {
                delete meta.error[key];
            }
        }
        const { stack, ...rest } = meta.error;
        return `${timestamp} [${label}] ${level}: ${message}${metaFormat(rest)}\n` +
            `${stack ?? ""}`;
    }
    return `${timestamp} [${label}] ${level}: ${message}${metaFormat(meta)}`;
});

/**
 * Creates a curried function, and call it with the module in use to get logs with filename
 * @param {typedefs.Module} callingModule The module from which the logger is called
 */
const curriedLogger = (callingModule) => {
    let winstonLogger = createLogger({
        levels: config.npm.levels,
        format: combine(
            errors({ stack: true }),
            label({ label: getLabel(callingModule) }),
            timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
            logFormat,
        ),
        transports: [
            new transports.Console({ level: "info" }),
            new transports.File({
                filename: __dirname + "/../logs/debug.log",
                level: "debug",
                maxsize: 10485760,
            }),
            new transports.File({
                filename: __dirname + "/../logs/error.log",
                level: "error",
                maxsize: 1048576,
            }),
        ]
    });
    winstonLogger.on("error", (error) => winstonLogger.error("Error inside logger", { error }));
    return winstonLogger;
}

module.exports = curriedLogger;
