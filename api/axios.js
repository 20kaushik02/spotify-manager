const axios = require('axios');

const { baseAPIURL, accountsAPIURL } = require("../constants");
const logger = require('../utils/logger')(module);

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

axiosInstance.interceptors.request.use(config => {
	logger.http("API call", {
		url: config.url,
		method: config.method,
		params: config.params ?? {},
		headers: Object.keys(config.headers),
	});
	return config;
});

axiosInstance.interceptors.response.use(
	(response) => response,
	(error) => {
		logger.warn("AxiosError", {
			error: {
				name: error.name,
				code: error.code,
				message: error.message,
			},
			req: error.config,
		});
		return Promise.reject(error);
	}
);

module.exports = {
	authInstance,
	axiosInstance
};
