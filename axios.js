const axios = require('axios');

const { baseAPIURL, accountsAPIURL } = require("./constants");

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

const getAuthHeaders = (req) => {
	let authHeaders;

	if (req.session.access_token) {
		authHeaders = {
			'Authorization': req.session.access_token ? `Bearer ${req.session.access_token}` : '',
		}
	}

	return authHeaders;
};

module.exports = {
	authInstance,
	axiosInstance,
	getAuthHeaders,
};