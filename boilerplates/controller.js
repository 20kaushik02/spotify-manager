const logger = require("../utils/logger")(module);

const typedefs = require("../typedefs");

/**
 * @param {typedefs.Req} req
 * @param {typedefs.Res} res
 */
const __controller_func = async (req, res) => {
	try {
		
	} catch (error) {
		logger.error('__controller_func', { error });
		return res.sendStatus(500);
	}
}

module.exports = {
	__controller_func
};