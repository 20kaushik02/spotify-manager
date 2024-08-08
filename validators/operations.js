const { body, header, param, query } = require("express-validator");

const typedefs = require("../typedefs");

/**
 * @param {typedefs.Req} req 
 * @param {typedefs.Res} res 
 * @param {typedefs.Next} next 
 */
const createLinkValidator = async (req, res, next) => {
	await body("from")
		.notEmpty()
		.withMessage("from not defined in body")
		.isURL()
		.withMessage("from must be a valid link")
		.run(req);
	await body("to")
		.notEmpty()
		.withMessage("to not defined in body")
		.isURL()
		.withMessage("to must be a valid link")
		.run(req);
	next();
}

module.exports = {
	createLinkValidator,
	removeLinkValidator: createLinkValidator,
	populateSingleLinkValidator: createLinkValidator,
	pruneSingleLinkValidator: createLinkValidator,
}
