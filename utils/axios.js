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

axiosInstance.interceptors.request.use(config => {
	logger.http("API call", {
		url: config.url,
		method: config.method,
		params: config.params ?? {},
	});
	return config;
});

axiosInstance.interceptors.response.use(
	(response) => response,
	(error) => {
		logger.warn("AxiosError", { req: error.config });
		if (error.response)
			return error.response;
		return Promise.reject(error);
	}
);

module.exports = {
	authInstance,
	axiosInstance
};
