require('dotenv').config();

const typedefs = require("../typedefs");
const { scopes, stateKey } = require('../constants');

const generateRandString = require('../utils/generateRandString');

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
			'https://accounts.spotify.com/authorize?' +
			new URLSearchParams({
				response_type: 'code',
				client_id: process.env.CLIENT_ID,
				scope: scope,
				redirect_uri: process.env.REDIRECT_URI,
				state: state
			}).toString()
		);
	} catch (error) {
		console.error(error);
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
		const code = req.query.code || null;
		const state = req.query.state || null;
		const error = req.query.error || null;
		const storedState = req.cookies ? req.cookies[stateKey] : null;

		// check state
		if (state === null || state !== storedState) {
			console.error('state mismatch');
			return res.redirect(409, '/');
		} else if (error !== null) {
			console.error(error);
			return res.status(401).send(`Error: ${error}`);
		} else {
			// get auth tokens
			res.clearCookie(stateKey);
			const authOptions = {
				url: 'https://accounts.spotify.com/api/token',
				form: {
					code: code,
					redirect_uri: process.env.REDIRECT_URI,
					grant_type: 'authorization_code'
				},
				headers: {
					'Authorization': 'Basic ' + (Buffer.from(process.env.CLIENT_ID + ':' + process.env.CLIENT_SECRET).toString('base64'))
				},
				responseType: 'json'
			};

			const { got } = await import("got");

			const response = await got.post(authOptions);
			if (response.statusCode === 200) {
				const access_token = response.body.access_token;
				const refresh_token = response.body.refresh_token;

				req.session.accessToken = access_token;
				req.session.refreshToken = refresh_token;
				req.session.cookie.maxAge = response.body.expires_in * 1000;

				req.session.save((err) => { if (err) throw err; });

				return res.status(200).send({
					message: "Login successful",
				});
			}
		}
	} catch (error) {
		console.error(error);
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
		const refresh_token = req.query.refresh_token;
		const authOptions = {
			url: 'https://accounts.spotify.com/api/token',
			headers: {
				'Authorization': 'Basic ' + (Buffer.from(process.env.CLIENT_ID + ':' + process.env.CLIENT_SECRET).toString('base64'))
			},
			form: {
				grant_type: 'refresh_token',
				refresh_token,
			},
			responseType: 'json'
		};

		const { got } = await import("got");

		const response = await got.post(authOptions);
		if (response.statusCode === 200) {
			const access_token = response.body.access_token;
			const updated_refresh_token = response.body.refresh_token ?? null;

			req.session.accessToken = access_token;
			req.session.refreshToken = updated_refresh_token ?? refresh_token;

			return res.status(200).send({
				message: `New access token obtained${(updated_refresh_token !== null) ? ' and refresh token updated' : ''}.`,
				access_token,
			});
		}
	} catch (error) {
		console.error(error);
		return res.status(500).send({ message: "Server Error. Try again." });
	}
};

module.exports = {
	login,
	callback,
	refresh
};