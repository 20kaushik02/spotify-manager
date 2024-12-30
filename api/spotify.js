
const logger = require("../utils/logger")(module);

const typedefs = require("../typedefs");

const { axiosInstance } = require("./axios");

const logPrefix = "Spotify API: ";

/**
 * Spotify API - one-off request handler
 * @param {typedefs.Req} req convenient auto-placing headers from middleware (not a good approach?)
 * @param {typedefs.Res} res handle failure responses here itself (not a good approach?)
 * @param {import("axios").Method} method HTTP method
 * @param {string} path request path
 * @param {import("axios").AxiosRequestConfig} config request params, headers, etc.
 * @param {any} data request body
 * @param {boolean} inlineData true if data is to be placed inside config
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
		return resp;
	} catch (error) {
		if (error.response) {
			// Non 2XX response received
			let logMsg;
			if (error.response.status >= 400 && error.response.status < 600) {
				res.status(error.response.status).send(error.response.data);
				logMsg = "" + error.response.status
			}
			else {
				res.sendStatus(error.response.status);
				logMsg = "???";
			}
			logger.warn(logPrefix + logMsg, {
				response: {
					data: error.response.data,
					status: error.response.status,
				}
			});
		} else if (error.request) {
			// No response received
			res.sendStatus(504);
			logger.error(logPrefix + "No response", { error });
		} else {
			// Something happened in setting up the request that triggered an Error
			res.sendStatus(500);
			logger.error(logPrefix + "Request failed?", { error });
		}

		return null;
	};
}

const getUserProfile = async (req, res) => {
	const response = await singleRequest(req, res,
		"GET", "/me",
		{ headers: { Authorization: `Bearer ${req.session.accessToken}` } }
	);
	return res.headersSent ? null : response.data;
}

const getUserPlaylistsFirstPage = async (req, res) => {
	const response = await singleRequest(req, res,
		"GET",
		`/users/${req.session.user.id}/playlists`,
		{
			params: {
				offset: 0,
				limit: 50,
			},
		});
	return res.headersSent ? null : response.data;
}

const getUserPlaylistsNextPage = async (req, res, nextURL) => {
	const response = await singleRequest(
		req, res, "GET", nextURL);
	return res.headersSent ? null : response.data;
}

const getPlaylistDetailsFirstPage = async (req, res, initialFields, playlistID) => {
	const response = await singleRequest(req, res,
		"GET",
		`/playlists/${playlistID}/`,
		{
			params: {
				fields: initialFields
			},
		});
	return res.headersSent ? null : response.data;
}

const getPlaylistDetailsNextPage = async (req, res, nextURL) => {
	const response = await singleRequest(
		req, res, "GET", nextURL);
	return res.headersSent ? null : response.data;
}

const addItemsToPlaylist = async (req, res, nextBatch, playlistID) => {
	const response = await singleRequest(req, res,
		"POST",
		`/playlists/${playlistID}/tracks`,
		{},
		{ uris: nextBatch }, false
	)
	return res.headersSent ? null : response.data;
}

const removeItemsFromPlaylist = async (req, res, nextBatch, playlistID, snapshotID) => {
	// API doesn't document this kind of deletion via the 'positions' field
	// but see here: https://github.com/spotipy-dev/spotipy/issues/95#issuecomment-2263634801
	const response = await singleRequest(req, res,
		"DELETE",
		`/playlists/${playlistID}/tracks`,
		{},
		// axios delete method doesn't have separate arg for body so hv to put it in config
		{ positions: nextBatch, snapshot_id: snapshotID }, true
	);
	return res.headersSent ? null : response.data;
}

const checkPlaylistEditable = async (req, res, playlistID, userID) => {
	let checkFields = ["collaborative", "owner(id)"];

	const checkFromData = await getPlaylistDetailsFirstPage(req, res, checkFields.join(), playlistID);
	if (res.headersSent) return false;

	// https://web.archive.org/web/20241226081630/https://developer.spotify.com/documentation/web-api/concepts/playlists#:~:text=A%20playlist%20can%20also%20be%20made%20collaborative
	// playlist is editable if it's collaborative (and thus private) or owned by the user
	if (checkFromData.collaborative !== true &&
		checkFromData.owner.id !== userID) {
		res.status(403).send({
			message: "You cannot edit this playlist, you must be the owner/the playlist must be collaborative",
			playlistID: playlistID
		});
		logger.info("user cannot edit target playlist", { playlistID: playlistID });
		return false;
	} else {
		return true;
	}
}

module.exports = {
	singleRequest,
	getUserProfile,
	getUserPlaylistsFirstPage,
	getUserPlaylistsNextPage,
	getPlaylistDetailsFirstPage,
	getPlaylistDetailsNextPage,
	addItemsToPlaylist,
	removeItemsFromPlaylist,
	checkPlaylistEditable,
}