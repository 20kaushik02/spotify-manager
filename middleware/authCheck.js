const typedefs = require("../typedefs");

/**
 * middleware to test if authenticated
 * @param {typedefs.Req} req 
 * @param {typedefs.Res} res 
 * @param {typedefs.Next} next 
 */
const isAuthenticated = (req, res, next) => {
	if (req.session.refreshToken && req.session.accessToken) {
		req.authHeader = `Bearer ${req.session.access_token}`;
		next()
	} else {
		res.status(401).redirect("/");
	}
}

module.exports = {
	isAuthenticated,
}