const { validationResult } = require("express-validator");

const typedefs = require("../typedefs");

/**
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
		[err.param]: err.msg
	}));

	return res.status(400).json({
		message: extractedErrors,
	})
}

module.exports = {
	validate,
}