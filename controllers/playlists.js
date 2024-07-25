const logger = require("../utils/logger")(module);

const typedefs = require("../typedefs");
const { axiosInstance } = require('../utils/axios');
const { parseSpotifyUri, parseSpotifyLink } = require("../utils/spotifyUriTransformer");

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
			`/users/${parseSpotifyUri(req.session.user.uri).id}/playlists`,
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
				{
					headers: {
						...req.authHeader
					}
				}
			);
			if (response.status >= 400 && response.status < 500)
				return res.status(response.status).send(response.data);

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

		return res.status(200).send(userPlaylists);
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
		/** @type {typedefs.UriObject} */
		let uri;
		let initialFields = ["collaborative", "description", "images", "name", "owner(uri,display_name)", "public",
			"snapshot_id", "tracks(next,total,items(is_local,track(name,uri)))"];
		let mainFields = ["next,items(is_local,track(name,uri))"];

		try {
			uri = parseSpotifyLink(req.query.playlist_link)
			if (uri.type !== "playlist") {
				return res.status(400).send("Not a playlist link");
			}
		} catch (error) {
			logger.error("parseSpotifyLink", { error });
			return res.sendStatus(400);
		}

		const response = await axiosInstance.get(
			`/playlists/${uri.id}/`,
			{
				params: {
					fields: initialFields.join()
				},
				headers: { ...req.authHeader }
			}
		);
		if (response.status >= 400 && response.status < 500)
			return res.status(response.status).send(response.data);

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
		playlist.next = new URL(response.data.tracks.next);
		playlist.next.searchParams.set("fields", mainFields.join());
		playlist.next = playlist.next.href;
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
				{
					headers: {
						...req.authHeader
					}
				}
			);

			if (nextResponse.status >= 400 && nextResponse.status < 500)
				return res.status(nextResponse.status).send(nextResponse.data);

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

		return res.status(200).send(playlist);
	} catch (error) {
		logger.error('getPlaylistDetails', { error });
		return res.sendStatus(500);
	}
}

module.exports = {
	getUserPlaylists,
	getPlaylistDetails
};
