const { authInstance, axiosInstance } = require("../utils/axios");

const typedefs = require("../typedefs");
const { scopes, stateKey, accountsAPIURL, sessionAgeInSeconds } = require('../constants');

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
		logger.error('login', { error });
		return res.sendStatus(500);
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

			const tokenResponse = await authInstance.post('/api/token', authPayload);

			if (tokenResponse.status === 200) {
				logger.info('New login.');
				req.session.accessToken = tokenResponse.data.access_token;
				req.session.refreshToken = tokenResponse.data.refresh_token;
				req.session.cookie.maxAge = 7 * 24 * 60 * 60 * 1000 // 1 week
			} else {
				logger.error('login failed', { statusCode: tokenResponse.status });
				res.status(tokenResponse.status).send('Error: Login failed');
			}

			const userResponse = await axiosInstance.get(
				"/me",
				{
					headers: {
						'Authorization': `Bearer ${req.session.accessToken}`
					}
				}
			);

			/** @type {typedefs.User} */
			req.session.user = {
				username: userResponse.data.display_name,
				id: userResponse.data.id,
			};

			return res.status(200).send({
				message: "Login successful",
			});
		}
	} catch (error) {
		logger.error('callback', { error });
		return res.sendStatus(500);
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

		if (response.status === 200) {
			req.session.accessToken = response.data.access_token;
			req.session.refreshToken = response.data.refresh_token ?? req.session.refreshToken; // refresh token rotation
			req.session.cookie.maxAge = 7 * 24 * 60 * 60 * 1000 // 1 week

			logger.info(`Access token refreshed${(response.data.refresh_token !== null) ? ' and refresh token updated' : ''}.`);
			return res.status(200).send({
				message: "New access token obtained",
			});
		} else {
			logger.error('refresh failed', { statusCode: response.status });
			return res.status(response.status).send('Error: Refresh token flow failed.');
		}
	} catch (error) {
		logger.error('refresh', { error });
		return res.sendStatus(500);
	}
};

/**
 * Clear session
 * @param {typedefs.Req} req
 * @param {typedefs.Res} res
 */
const logout = async (req, res) => {
	try {
		const delSession = req.session.destroy((err) => {
			if (err) {
				logger.error("Error while logging out", { err });
				return res.sendStatus(500);
			} else {
				logger.info("Logged out.", { sessionID: delSession.id });
				res.clearCookie("connect.sid");
				return res.sendStatus(200);
			}
		})
	} catch (error) {
		logger.error('logout', { error });
		return res.sendStatus(500);
	}
}

module.exports = {
	login,
	callback,
	refresh,
	logout
};
