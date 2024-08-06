
const logger = require("../utils/logger")(module);

const typedefs = require("../typedefs");

const { axiosInstance } = require("../utils/axios");

const logPrefix = "Spotify API: ";

/**
 * Spotify API - one-off request handler
 * @param {typedefs.Req} req convenient auto-placing headers from middleware (not a good approach?)
 * @param {typedefs.Res} res handle failure responses here itself (not a good approach?)
 * @param {import('axios').Method} method HTTP method
 * @param {string} path request path
 * @param {import('axios').AxiosRequestConfig} config request params, headers, etc.
 * @param {any} data request body
 * @param {boolean} inlineData true if data is to be placed inside config
 * @returns {Promise<{ success: boolean, resp: any }>}
 */
const singleRequest = async (req, res, method, path, config = {}, data = null, inlineData = false) => {
	let resp;
	config.headers = { ...config.headers, ...req.sessHeaders };
	try {
		if (!data || (data && inlineData)) {
			if (data)
				config.data = data ?? null;
			resp = await axiosInstance[method.toLowerCase()](path, config);
		} else
			resp = await axiosInstance[method.toLowerCase()](path, data, config);

		logger.debug(logPrefix + "Successful response received.");
		return { success: true, resp };
	} catch (error) {
		if (error.response) {
			// Non 2XX response received
			let logMsg;
			if (error.response.status >= 400 && error.response.status < 600) {
				res.status(error.response.status).send(error.response.data);
				logMsg = '' + error.response.status
			}
			else {
				res.sendStatus(error.response.status);
				logMsg = "???";
			}
			logger.error(logPrefix + logMsg, {
				response: {
					data: error.response.data,
					status: error.response.status,
				}
			});
		} else if (error.request) {
			// No response received
			res.sendStatus(504);
			logger.warn(logPrefix + "No response");
		} else {
			// Something happened in setting up the request that triggered an Error
			res.sendStatus(500);
			logger.error(logPrefix + "Request failed?");
		}

		return { success: false };
	};
}


module.exports = {
	singleRequest,
}