/**
 * Returns a single string of the values of all keys in the given JSON object, even nested ones.
 * 
 * @param {*} obj 
 * @returns
 */
const getNestedValuesString = (obj) => {
	let values = [];
	for (key in obj) {
		if (typeof obj[key] !== "object") {
			values.push(obj[key]);
		} else {
			values = values.concat(getNestedValuesString(obj[key]));
		}
	}

	return values.join();
}

module.exports = {
	getNestedValuesString
}