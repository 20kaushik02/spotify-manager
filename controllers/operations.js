const logger = require("../utils/logger")(module);
const { axiosInstance } = require("../utils/axios");
const { parseSpotifyUri } = require("../utils/spotifyUriTransformer");

const typedefs = require("../typedefs");
/** @type {typedefs.Model} */
const userPlaylists = require("../models").userPlaylists;

/**
 * Store user's playlists
 * @param {typedefs.Req} req
 * @param {typedefs.Res} res
 */
const updateUser = async (req, res) => {
	try {
		let currentPlaylists = [];
		const userURI = parseSpotifyUri(req.session.user.uri);

		// get first 50
		const response = await axiosInstance.get(
			`/users/${userURI.id}/playlists`,
			{
				params: {
					offset: 0,
					limit: 50,
				},
				headers: {
					...req.authHeader
				}
			}
		);

		if (response.status >= 400 && response.status < 500)
			return res.status(response.status).send(response.data);

		currentPlaylists = response.data.items.map(playlist => parseSpotifyUri(playlist.uri).id);
		nextURL = response.data.next;

		// keep getting batches of 50 till exhausted
		while (nextURL) {
			const nextResponse = await axiosInstance.get(
				nextURL, // absolute URL from previous response which has params
				{
					headers: {
						...req.authHeader
					}
				}
			);
			if (response.status >= 400 && response.status < 500)
				return res.status(response.status).send(response.data);

			currentPlaylists.push(
				...nextResponse.data.items.map(playlist => parseSpotifyUri(playlist.uri).id)
			);

			nextURL = nextResponse.data.next;
		}


		let oldPlaylists = await userPlaylists.findAll({
			attributes: ["playlistID"],
			raw: true,
			where: {
				userID: userURI.id
			},
		});

		let toRemove, toAdd;
		if (oldPlaylists.length) {
			// existing user
			oldPlaylists = oldPlaylists.map(pl => pl.playlistID);
			const currentSet = new Set(currentPlaylists);
			const oldSet = new Set(oldPlaylists);

			toAdd = currentPlaylists.filter(current => !oldSet.has(current));
			toRemove = oldPlaylists.filter(old => !currentSet.has(old));
		} else {
			// new user
			toAdd = currentPlaylists;
			toRemove = [];
		}

		if (toRemove.length) {
			const cleanedUser = await userPlaylists.destroy({
				where: { playlistID: toRemove }
			});
			if (cleanedUser !== toRemove.length) {
				logger.error("Could not remove old playlists", { error: new Error("model.destroy failed?") });
				return res.sendStatus(500);
			}
		}

		if (toAdd.length) {
			const updatedUser = await userPlaylists.bulkCreate(
				toAdd.map((pl) => { return { playlistID: pl, userID: userURI.id } }),
				{ validate: true }
			);
			if (updatedUser.length !== toAdd.length) {
				logger.error("Could not add new playlists", { error: new Error("model.bulkCreate failed?") });
				return res.sendStatus(500);
			}
		}

		return res.sendStatus(200);
	} catch (error) {
		logger.error('updateUser', { error });
		return res.sendStatus(500);
	}
}

module.exports = {
	updateUser
};
