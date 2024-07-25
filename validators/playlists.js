const { body, header, param, query } = require("express-validator");

const typedefs = require("../typedefs");

/**
 * @param {typedefs.Req} req 
 * @param {typedefs.Res} res 
 * @param {typedefs.Next} next 
 */
const getPlaylistDetailsValidator = async (req, res, next) => {
	await query("playlist_id")
		.notEmpty()
		.withMessage("playlist_id not defined in query")
		.isAlphanumeric()
		.withMessage("playlist_id must be alphanumeric (base-62)")
		.run(req);
	next();
}

module.exports = {
	getPlaylistDetailsValidator
}
