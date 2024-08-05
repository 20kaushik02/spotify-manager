
const logger = require("../utils/logger")(module);

const typedefs = require("../typedefs");

const { axiosInstance } = require("../utils/axios");

/**
 * Spotify API - one-off request handler
 * @param {typedefs.Req} req needed for auto-placing headers from middleware
 * @param {typedefs.Res} res handle failure responses here itself
 * @param {typedefs.AxiosMethod} method HTTP method
 * @param {string} path request path
 * @param {typedefs.AxiosRequestConfig} config request params, headers, etc.
 * @param {any} data request body
 * @param {boolean} inlineData true if data is to be placed inside config
 * @returns {Promise<{ success: boolean, resp?: any }>}
 */
const singleRequest = async (req, res, method, path, config = {}, data = null, inlineData = false) => {
	let resp;
	config.headers = { ...config.headers, ...req.sessHeaders };
	try {
		if (!data || (data && inlineData)) {
			if (data)
				config.data = data ?? null;
			resp = await axiosInstance[method.toLowerCase()](path, config);
		} else {
			resp = await axiosInstance[method.toLowerCase()](path, data, config);
		}

		if (resp.status >= 400 && resp.status < 500) {
			res.status(resp.status).send(resp.data);
			logger.debug("4XX Response", { resp });
			return { success: false };
		}
		else if (resp.status >= 500) {
			res.sendStatus(resp.status);
			logger.warn("5XX Response", { resp });
			return { success: false };
		}

		logger.debug("Response received.");
		return { success: true, resp };
	} catch (error) {
		res.sendStatus(500);
		logger.error("Request threw an error.", { error });
		return { success: false };
	}
}

module.exports = {
	singleRequest,
}