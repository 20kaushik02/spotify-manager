const { body, header, param, query } = require("express-validator");

const typedefs = require("../typedefs");

/**
 * @param {typedefs.Req} req 
 * @param {typedefs.Res} res 
 * @param {typedefs.Next} next 
 */
const getPlaylistDetailsValidator = async (req, res, next) => {
	await query("playlist_link")
		.notEmpty()
		.withMessage("playlist_link not defined in query")
		.isURL()
		.withMessage("playlist_link must be a valid link")
		.run(req);
	next();
}

module.exports = {
	getPlaylistDetailsValidator
}
