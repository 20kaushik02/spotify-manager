const path = require("path");

const { createLogger, transports, config, format } = require('winston');
const { colorize, combine, label, timestamp, printf, errors } = format;

const typedefs = require("../typedefs");

const getLabel = (callingModule) => {
    const parts = callingModule.filename.split(path.sep);
    return path.join(parts[parts.length - 2], parts.pop());
};

const allowedErrorKeys = ["name", "message", "stack"];

const logMetaReplacer = (key, value) => {
    if (key === "error") {
        return {
            name: value.name,
            message: value.message,
            stack: value.stack,
        };
    }
    return value;
}

const metaFormat = (meta) => {
    if (Object.keys(meta).length > 0)
        return '\n' + JSON.stringify(meta, logMetaReplacer, "\t") + '\n';
    return '\n';
}

const logFormat = printf(({ level, message, label, timestamp, ...meta }) => {
    if (meta.error) { // if the error was passed
        for (const key in meta.error) {
            if (!allowedErrorKeys.includes(key)) {
                delete meta.error[key];
            }
        }
    }
    return `${timestamp} [${label}] ${level}: ${message}${metaFormat(meta)}`;
});

/**
 * Creates a curried function, and call it with the module in use to get logs with filename
 * @param {typedefs.Module} callingModule The module from which the logger is called
 * @returns {typedefs.Logger} 
 */
const logger = (callingModule) => {
    return createLogger({
        levels: config.npm.levels,
        format: combine(
            errors({ stack: true }),
            label({ label: getLabel(callingModule) }),
            timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
            logFormat,
        ),
        transports: [
            new transports.Console({ level: 'debug' }),
            new transports.File({
                filename: __dirname + '/../logs/debug.log',
                level: 'debug',
                maxsize: 10485760,
            }),
            new transports.File({
                filename: __dirname + '/../logs/error.log',
                level: 'error',
                maxsize: 10485760,
            }),
        ]
    });
}

module.exports = logger;