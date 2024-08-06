const { authInstance, axiosInstance } = require("../utils/axios");

const typedefs = require("../typedefs");
const { scopes, stateKey, accountsAPIURL, sessionAgeInSeconds, sessionName } = require('../constants');

const generateRandString = require('../utils/generateRandString');
const { singleRequest } = require("./apiCall");
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
		res.redirect(
			`${accountsAPIURL}/authorize?` +
			new URLSearchParams({
				response_type: 'code',
				client_id: process.env.CLIENT_ID,
				scope: scope,
				redirect_uri: process.env.REDIRECT_URI,
				state: state
			}).toString()
		);
		return;
	} catch (error) {
		res.sendStatus(500);
		logger.error('login', { error });
		return;
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
			res.redirect(409, '/');
			logger.error('state mismatch');
			return;
		} else if (error) {
			res.status(401).send("Auth callback error");
			logger.error('callback error', { error });
			return;
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
				logger.debug('Tokens obtained.');
				req.session.accessToken = tokenResponse.data.access_token;
				req.session.refreshToken = tokenResponse.data.refresh_token;
				req.session.cookie.maxAge = 7 * 24 * 60 * 60 * 1000 // 1 week
			} else {
				logger.error('login failed', { statusCode: tokenResponse.status });
				res.status(tokenResponse.status).send('Error: Login failed');
			}

			const userResp = await singleRequest(req, res,
				"GET", "/me",
				{ headers: { Authorization: `Bearer ${req.session.accessToken}` } }
			);
			if (!userResp.success) return;
			const userData = userResp.resp.data;

			/** @type {typedefs.User} */
			req.session.user = {
				username: userData.display_name,
				id: userData.id,
			};

			res.sendStatus(200);
			logger.info("New login.", { username: userData.display_name });
			return;
		}
	} catch (error) {
		res.sendStatus(500);
		logger.error('callback', { error });
		return;
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

			res.sendStatus(200);
			logger.info(`Access token refreshed${(response.data.refresh_token !== null) ? ' and refresh token updated' : ''}.`);
			return;
		} else {
			res.status(response.status).send('Error: Refresh token flow failed.');
			logger.error('refresh failed', { statusCode: response.status });
			return;
		}
	} catch (error) {
		res.sendStatus(500);
		logger.error('refresh', { error });
		return;
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
				res.sendStatus(500);
				logger.error("Error while logging out", { err });
				return;
			} else {
				res.clearCookie(sessionName);
				res.sendStatus(200);
				logger.info("Logged out.", { sessionID: delSession.id });
				return;
			}
		})
	} catch (error) {
		res.sendStatus(500);
		logger.error('logout', { error });
		return;
	}
}

module.exports = {
	login,
	callback,
	refresh,
	logout
};
