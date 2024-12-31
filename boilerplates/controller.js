const logger = require("../utils/logger")(module);

const typedefs = require("../typedefs");

/**
 * @param {typedefs.Req} req
 * @param {typedefs.Res} res
 */
const __controller_func = async (req, res) => {
	try {

	} catch (error) {
		res.status(500).send({ message: "Internal Server Error" });
		logger.error("__controller_func", { error });
		return;
	}
}

module.exports = {
	__controller_func
};
