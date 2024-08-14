const { validationResult } = require("express-validator");

const { getNestedValuesString } = require("../utils/jsonTransformer");
const logger = require("../utils/logger")(module);

const typedefs = require("../typedefs");

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

	const extractedErrors = [];
	errors.array().forEach(err => {
		if (err.type === 'alternative') {
			err.nestedErrors.forEach(nestedErr => {
				extractedErrors.push({
					[nestedErr.path]: nestedErr.msg
				});
			});
		} else if (err.type === 'field') {
			extractedErrors.push({
				[err.path]: err.msg
			});
		}
	});

	res.status(400).json({
		message: getNestedValuesString(extractedErrors),
		errors: extractedErrors
	});
	logger.warn("invalid request", { extractedErrors });
	return;
}

module.exports = {
	validate
};
