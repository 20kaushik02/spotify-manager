const { body, header, param, query } = require("express-validator");

const typedefs = require("../typedefs");

/**
 * @param {typedefs.Req} req 
 * @param {typedefs.Res} res 
 * @param {typedefs.Next} next 
 */
const __validator_func = async (req, res, next) => {
	await body('field_name')
		.notEmpty()
		.withMessage('field_name not defined in body')
		.run(req);

	next();
}

module.exports = {
	__validator_func,
}

