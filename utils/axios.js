const axios = require('axios');

const { baseAPIURL, accountsAPIURL } = require("../constants");
const logger = require('./logger')(module);

const authInstance = axios.default.create({
	baseURL: accountsAPIURL,
	timeout: 20000,
	headers: {
		'Content-Type': 'application/x-www-form-urlencoded',
		'Authorization': 'Basic ' + (Buffer.from(process.env.CLIENT_ID + ':' + process.env.CLIENT_SECRET).toString('base64'))
	},
});

const axiosInstance = axios.default.create({
	baseURL: baseAPIURL,
	timeout: 20000,
	headers: {
		'Content-Type': 'application/json'
	},
});

axiosInstance.interceptors.request.use(request => {
	logger.info("API call", {
		url: request.url,
		params: request.params,
	});
	return request;
})

axiosInstance.interceptors.response.use(
	(response) => response,
	(error) => {
		if (error.response) {
			// Server has responded
			logger.error(
				"API: Error", {
				response: {
					status: error.response.status,
					statusText: error.response.statusText,
					data: error.response.data
				}
			});
			return error.response;
		} else if (error.request) {
			// The request was made but no response was received
			logger.error(
				"API: No response", {
				request: {
					url: error.request?.url,
					params: error.request?.params,
				}
			});
		} else {
			// Something happened in setting up the request that triggered an Error
			logger.error(
				"API: Request error", {
				error: {
					message: error.message,
				}
			});
		}
		return Promise.reject(error);
	}
)

module.exports = {
	authInstance,
	axiosInstance,
};