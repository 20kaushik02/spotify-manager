const typedefs = require("../typedefs");
const logger = require("../utils/logger")(module);

/**
 * middleware to check if access token is present
 * @param {typedefs.Req} req 
 * @param {typedefs.Res} res 
 * @param {typedefs.Next} next 
 */
const isAuthenticated = (req, res, next) => {
	if (req.session.accessToken) {
		req.authHeader = { 'Authorization': `Bearer ${req.session.accessToken}` };
		next()
	} else {
		const delSession = req.session.destroy((err) => {
			if (err) {
				logger.error("Error while destroying session.", { err });
				return res.sendStatus(500);
			} else {
				logger.info("Session invalid, destroyed.", { sessionID: delSession.id });
				res.clearCookie("connect.sid");
				return res.sendStatus(401);
			}
		});
	}
}

module.exports = {
	isAuthenticated,
}