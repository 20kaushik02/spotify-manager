const { authInstance } = require("../axios");

const typedefs = require("../typedefs");
const { scopes, stateKey, accountsAPIURL } = require('../constants');

const generateRandString = require('../utils/generateRandString');
const logger = require('../utils/logger')(module);

/**
 * Stateful redirect to Spotify login with credentials
 * @param {typedefs.Req} req
 * @param {typedefs.Res} res
 */
const login = (_req, res) => {
	try {
		const state = generateRandString(16);
		res.cookie(stateKey, state);

		const scope = Object.values(scopes).join(' ');
		return res.redirect(
			`${accountsAPIURL}/authorize?` +
			new URLSearchParams({
				response_type: 'code',
				client_id: process.env.CLIENT_ID,
				scope: scope,
				redirect_uri: process.env.REDIRECT_URI,
				state: state
			}).toString()
		);
	} catch (error) {
		logger.error('Error', { error });
		return res.status(500).send({ message: "Server Error. Try again." });
	}
}

/**
 * Exchange authorization code for refresh and access tokens
 * @param {typedefs.Req} req 
 * @param {typedefs.Res} res 
 */
const callback = async (req, res) => {
	try {
		const { code, state, error } = req.query;
		const storedState = req.cookies ? req.cookies[stateKey] : null;

		// check state
		if (state === null || state !== storedState) {
			logger.error('state mismatch');
			return res.redirect(409, '/');
		} else if (error) {
			logger.error('callback error', { authError: error });
			return res.status(401).send({ message: `Auth callback error` });
		} else {
			// get auth tokens
			res.clearCookie(stateKey);

			const authForm = {
				code: code,
				redirect_uri: process.env.REDIRECT_URI,
				grant_type: 'authorization_code'
			}

			const authPayload = (new URLSearchParams(authForm)).toString();

			const response = await authInstance.post('/api/token', authPayload);

			if (response.status === 200) {
				req.session.accessToken = response.data.access_token;
				req.session.refreshToken = response.data.refresh_token;
				req.session.cookie.maxAge = response.data.expires_in * 1000;

				req.session.save((err) => { if (err) throw err; });

				logger.info('New login.')
				return res.status(200).send({
					message: "Login successful",
				});
			} else {
				logger.error('login failed', { statusCode: response.status });
				res.status(response.status).send('Error: Login failed');
			}
		}
	} catch (error) {
		logger.error('Error', { error });
		return res.status(500).send({ message: "Server Error. Try again." });
	}
}

/**
 * Request new access token using refresh token
 * @param {typedefs.Req} req 
 * @param {typedefs.Res} res
 */
const refresh = async (req, res) => {
	try {
		const authForm = {
			refresh_token: req.session.refreshToken,
			grant_type: 'refresh_token',
		}

		const authPayload = (new URLSearchParams(authForm)).toString();

		const response = await authInstance.post('/api/token', authPayload);

		if (response.statusCode === 200) {
			req.session.accessToken = response.data.access_token;
			req.session.refreshToken = response.data.refresh_token ?? req.session.refreshToken;
			req.session.cookie.maxAge = response.data.expires_in * 1000;

			logger.info(`Access token refreshed${(response.data.refresh_token !== null) ? ' and refresh token updated' : ''}.`);
			return res.status(200).send({
				message: "New access token obtained",
			});
		} else {
			logger.error('refresh failed', { statusCode: response.status });
			res.status(response.status).send('Error: Refresh token flow failed.');
		}
	} catch (error) {
		logger.error('Error', { error });
		return res.status(500).send({ message: "Server Error. Try again." });
	}
};

module.exports = {
	login,
	callback,
	refresh
};