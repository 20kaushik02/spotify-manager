const { validationResult } = require("express-validator");

const typedefs = require("../typedefs");
const { getNestedValuesString } = require("../utils/jsonTransformer");
const logger = require("../utils/logger")(module);

/**
 * Refer: https://stackoverflow.com/questions/58848625/access-messages-in-express-validator
 * 
 * @param {typedefs.Req} req 
 * @param {typedefs.Res} res 
 * @param {typedefs.Next} next 
 */
const validate = (req, res, next) => {
	const errors = validationResult(req);
	if (errors.isEmpty()) {
		return next();
	}
	const extractedErrors = []
	errors.array().map(err => extractedErrors.push({
		[err.path]: err.msg
	}));

	return res.status(400).json({
		message: getNestedValuesString(extractedErrors),
		errors: extractedErrors
	})
}

module.exports = {
	validate,
}