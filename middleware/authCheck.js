const typedefs = require("../typedefs");
const logger = require("../utils/logger")(module);

/**
 * middleware to test if authenticated
 * 
 * TODO: not checking if tokens are valid
 * @param {typedefs.Req} req 
 * @param {typedefs.Res} res 
 * @param {typedefs.Next} next 
 */
const isAuthenticated = (req, res, next) => {
	if (req.session.refreshToken && req.session.accessToken) {
		// TODO: find a better way to set bearer token
		req.authHeader = { 'Authorization': `Bearer ${req.session.accessToken}` };
		next()
	} else {
		const delSession = req.session.destroy();
		logger.info("Session destroyed.", { sessionID: delSession.id });
		res.status(401).redirect("/");
	}
}

module.exports = {
	isAuthenticated,
}