require('dotenv').config();

const typedefs = require("../typedefs");

/**
 * @param {typedefs.Req} req
 * @param {typedefs.Res} res
 */
const __controller_func = async (req, res) => {
	try {
		
	} catch (error) {
		console.error(error);
		return res.status(500).send({ message: "Server Error. Try again." });
	}
}

module.exports = {
	__controller_func
};