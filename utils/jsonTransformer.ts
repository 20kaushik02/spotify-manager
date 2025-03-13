/** Stringifies only values of a JSON object, including nested ones */
const getNestedValuesString = (obj: any, delimiter: string = ", "): string => {
  let values: string[] = [];
  for (const key in obj) {
    if (typeof obj[key] !== "object") {
      values.push(obj[key]);
    } else {
      values = values.concat(getNestedValuesString(obj[key]));
    }
  }

  return values.join(delimiter);
};

export { getNestedValuesString };
