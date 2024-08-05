const logger = require("../utils/logger")(module);

const typedefs = require("../typedefs");
const { axiosInstance } = require('../utils/axios');
const { parseSpotifyLink } = require("../utils/spotifyURITransformer");

/**
 * Retrieve list of all of user's playlists
 * @param {typedefs.Req} req
 * @param {typedefs.Res} res
 */
const getUserPlaylists = async (req, res) => {
	try {
		let userPlaylists = {};

		// get first 50
		const response = await axiosInstance.get(
			`/users/${req.session.user.id}/playlists`,
			{
				params: {
					offset: 0,
					limit: 50,
				},
				headers: req.sessHeaders
			}
		);

		if (response.status >= 400 && response.status < 500)
			return res.status(response.status).send(response.data);
		else if (response.status >= 500)
			return res.sendStatus(response.status);

		userPlaylists.total = response.data.total;

		/** @type {typedefs.SimplifiedPlaylist[]} */
		userPlaylists.items = response.data.items.map((playlist) => {
			return {
				uri: playlist.uri,
				images: playlist.images,
				name: playlist.name,
				total: playlist.tracks.total
			}
		});

		userPlaylists.next = response.data.next;

		// keep getting batches of 50 till exhausted
		while (userPlaylists.next) {
			const nextResponse = await axiosInstance.get(
				userPlaylists.next, // absolute URL from previous response which has params
				{ headers: req.sessHeaders }
			);
			if (response.status >= 400 && response.status < 500)
				return res.status(response.status).send(response.data);
			else if (response.status >= 500)
				return res.sendStatus(response.status);

			userPlaylists.items.push(
				...nextResponse.data.items.map((playlist) => {
					return {
						uri: playlist.uri,
						images: playlist.images,
						name: playlist.name,
						total: playlist.tracks.total
					}
				})
			);

			userPlaylists.next = nextResponse.data.next;
		}

		delete userPlaylists.next;

		res.status(200).send(userPlaylists);
		logger.debug("Fetched user's playlists", { num: userPlaylists.total });
		return;
	} catch (error) {
		logger.error('getUserPlaylists', { error });
		return res.sendStatus(500);
	}
}

/**
 * Retrieve an entire playlist
 * @param {typedefs.Req} req 
 * @param {typedefs.Res} res 
 */
const getPlaylistDetails = async (req, res) => {
	try {
		/** @type {typedefs.Playlist} */
		let playlist = {};
		/** @type {typedefs.URIObject} */
		let uri;
		let initialFields = ["collaborative", "description", "images", "name", "owner(uri,display_name)", "public",
			"snapshot_id", "tracks(next,total,items(is_local,track(name,uri)))"];
		let mainFields = ["next,items(is_local,track(name,uri))"];

		try {
			uri = parseSpotifyLink(req.query.playlist_link)
			if (uri.type !== "playlist") {
				res.status(400).send({ message: "Link is not a playlist" });
				logger.warn("non-playlist link provided", { uri });
				return;
			}
		} catch (error) {
			res.status(400).send({ message: "Invalid Spotify playlist link" });
			logger.error("parseSpotifyLink", { error });
			return;
		}

		const response = await axiosInstance.get(
			`/playlists/${uri.id}/`,
			{
				params: {
					fields: initialFields.join()
				},
				headers: req.sessHeaders
			}
		);
		if (response.status >= 400 && response.status < 500)
			return res.status(response.status).send(response.data);
		else if (response.status >= 500)
			return res.sendStatus(response.status);

		// TODO: this whole section needs to be DRYer
		// look into serializr
		playlist.name = response.data.name;
		playlist.description = response.data.description;
		playlist.collaborative = response.data.collaborative;
		playlist.public = response.data.public;
		playlist.images = { ...response.data.images };
		playlist.owner = { ...response.data.owner };
		playlist.snapshot_id = response.data.snapshot_id;
		playlist.total = response.data.tracks.total;

		// previous fields get carried over to the next URL, but most of these fields are not present in the new endpoint
		// API shouldn't be returning such URLs, the problem's in the API ig...
		if (response.data.tracks.next) {
			playlist.next = new URL(response.data.tracks.next);
			playlist.next.searchParams.set("fields", mainFields.join());
			playlist.next = playlist.next.href;
		}
		playlist.tracks = response.data.tracks.items.map((playlist_item) => {
			return {
				is_local: playlist_item.is_local,
				track: {
					name: playlist_item.track.name,
					type: playlist_item.track.type,
					uri: playlist_item.track.uri
				}
			}
		});


		// keep getting batches of 50 till exhausted
		while (playlist.next) {
			const nextResponse = await axiosInstance.get(
				playlist.next, // absolute URL from previous response which has params
				{ headers: req.sessHeaders }
			);

			if (nextResponse.status >= 400 && nextResponse.status < 500)
				return res.status(nextResponse.status).send(nextResponse.data);
			else if (nextResponse.status >= 500)
				return res.sendStatus(nextResponse.status);

			playlist.tracks.push(
				...nextResponse.data.items.map((playlist_item) => {
					return {
						is_local: playlist_item.is_local,
						track: {
							name: playlist_item.track.name,
							type: playlist_item.track.type,
							uri: playlist_item.track.uri
						}
					}
				})
			);

			playlist.next = nextResponse.data.next;
		}

		delete playlist.next;

		res.status(200).send(playlist);
		logger.info("Fetched playlist tracks", { num: playlist.tracks.length });
		return;
	} catch (error) {
		res.sendStatus(500);
		logger.error('getPlaylistDetails', { error });
		return;
	}
}

module.exports = {
	getUserPlaylists,
	getPlaylistDetails
};
