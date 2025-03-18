import { zeroPaddedString } from "./getFormattedNumber.ts";

/**
 * Returns a timestamp string to use for timestamped files
 * @returns String of current datetime in YYYYMMDD-HHMMSS format
 */
const dateForFilename = (): string => {
  const dt = new Date();
  return `${dt.getFullYear()}${zeroPaddedString(
    dt.getMonth() + 1,
    2,
    "before"
  )}${zeroPaddedString(dt.getDate(), 2, "before")}-${zeroPaddedString(
    dt.getHours(),
    2,
    "before"
  )}${zeroPaddedString(dt.getMinutes(), 2, "before")}${zeroPaddedString(
    dt.getSeconds(),
    2,
    "before"
  )}`;
};

export { dateForFilename };
