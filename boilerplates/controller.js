const logger = require("../utils/logger")(module);

const typedefs = require("../typedefs");

/**
 * @param {typedefs.Req} req
 * @param {typedefs.Res} res
 */
const __controller_func = async (req, res) => {
	try {

	} catch (error) {
		res.sendStatus(500);
		logger.error('__controller_func', { error });
		return;
	}
}

module.exports = {
	__controller_func
};
