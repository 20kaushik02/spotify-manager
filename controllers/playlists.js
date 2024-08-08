const logger = require("../utils/logger")(module);

const typedefs = require("../typedefs");
const { getUserPlaylistsFirstPage, getUserPlaylistsNextPage, getPlaylistDetailsFirstPage, getPlaylistDetailsNextPage } = require("../api/spotify");
const { parseSpotifyLink } = require("../utils/spotifyURITransformer");

/**
 * Retrieve list of all of user's playlists
 * @param {typedefs.Req} req
 * @param {typedefs.Res} res
 */
const fetchUserPlaylists = async (req, res) => {
	try {
		let userPlaylists = {};

		// get first 50
		const respData = await getUserPlaylistsFirstPage(req, res);
		if (res.headersSent) return;

		userPlaylists.total = respData.total;

		userPlaylists.items = respData.items.map((playlist) => {
			return {
				uri: playlist.uri,
				images: playlist.images,
				name: playlist.name,
				total: playlist.tracks.total
			}
		});

		userPlaylists.next = respData.next;
		// keep getting batches of 50 till exhausted
		while (userPlaylists.next) {
			const nextData = await getUserPlaylistsNextPage(req, res, userPlaylists.next);
			if (res.headersSent) return;

			userPlaylists.items.push(
				...nextData.items.map((playlist) => {
					return {
						uri: playlist.uri,
						images: playlist.images,
						name: playlist.name,
						total: playlist.tracks.total
					}
				})
			);

			userPlaylists.next = nextData.next;
		}

		delete userPlaylists.next;

		res.status(200).send(userPlaylists);
		logger.debug("Fetched user's playlists", { num: userPlaylists.total });
		return;
	} catch (error) {
		res.sendStatus(500);
		logger.error('fetchUserPlaylists', { error });
		return;
	}
}

/**
 * Retrieve an entire playlist
 * @param {typedefs.Req} req 
 * @param {typedefs.Res} res 
 */
const fetchPlaylistDetails = async (req, res) => {
	try {
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
			res.status(400).send({ message: error.message });
			logger.error("parseSpotifyLink", { error });
			return;
		}

		const respData = await getPlaylistDetailsFirstPage(req, res, initialFields.join(), uri.id);
		if (res.headersSent) return;

		// TODO: this whole section needs to be DRYer
		// look into serializr
		playlist.name = respData.name;
		playlist.description = respData.description;
		playlist.collaborative = respData.collaborative;
		playlist.public = respData.public;
		playlist.images = [...respData.images];
		playlist.owner = { ...respData.owner };
		playlist.snapshot_id = respData.snapshot_id;
		playlist.total = respData.tracks.total;

		// previous fields get carried over to the next URL, but most of these fields are not present in the new endpoint
		// API shouldn't be returning such URLs, the problem's in the API ig...
		if (respData.tracks.next) {
			playlist.next = new URL(respData.tracks.next);
			playlist.next.searchParams.set("fields", mainFields.join());
			playlist.next = playlist.next.href;
		}
		playlist.tracks = respData.tracks.items.map((playlist_item) => {
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
			const nextData = await getPlaylistDetailsNextPage(req, res, playlist.next);
			if (res.headersSent) return;

			playlist.tracks.push(
				...nextData.items.map((playlist_item) => {
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

			playlist.next = nextData.next;
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
	fetchUserPlaylists,
	fetchPlaylistDetails
};
