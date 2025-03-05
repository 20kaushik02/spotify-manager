/**
 * Stringifies only values of a JSON object, including nested ones
 *
 * @param {any} obj JSON object
 * @param {string} delimiter Delimiter of final string
 * @returns {string}
 */
export const getNestedValuesString = (obj, delimiter = ", ") => {
  let values = [];
  for (key in obj) {
    if (typeof obj[key] !== "object") {
      values.push(obj[key]);
    } else {
      values = values.concat(getNestedValuesString(obj[key]));
    }
  }

  return values.join(delimiter);
}
