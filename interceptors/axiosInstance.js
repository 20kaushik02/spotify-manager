const axios = require('axios');

const { baseAPIURL } = require("../constants");

const axiosInstance = axios.default.create({
	baseURL: baseAPIURL,
	timeout: 20000,
});

const getHeaders = () => {
	let headers;

	headers = {
		'Content-Type': 'application/json',
	};

	if (req.session.access_token) {
		headers = {
			...headers,
			'Authorization': req.session.access_token ? `Bearer ${req.session.access_token}` : '',
		}
	}

	return headers;
};

module.exports = {
	axiosInstance,
	getHeaders,
};