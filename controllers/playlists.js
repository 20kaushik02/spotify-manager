const logger = require("../utils/logger")(module);

const typedefs = require("../typedefs");
const { axiosInstance } = require('../utils/axios');

/**
 * Retrieve list of all of user's playlists
 * @param {typedefs.Req} req
 * @param {typedefs.Res} res
 */
const getUserPlaylists = async (req, res) => {
	try {
		let playlists = {};

		// get first 50
		const response = await axiosInstance.get(
			"/me/playlists",
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

		if (response.status === 401)	{
			return res.status(401).send(response.data);
		}

		/** @type {typedefs.SimplifiedPlaylist[]} */
		playlists.items = response.data.items.map((playlist) => {
			return {
				name: playlist.name,
				description: playlist.description,
				owner_name: playlist.owner.display_name,
				id: playlist.id,
			}
		});

		playlists.total = response.data.total;
		playlists.next = response.data.next;

		// keep getting batches of 50 till exhausted
		while (playlists.next) {
			const nextResponse = await axiosInstance.get(
				playlists.next, // absolute URL from previous response which has offset and limit params
				{
					headers: {
						...req.authHeader
					}
				}
			);
			if (response.status === 401)
				return res.status(401).send(response.data);

			playlists.items.push(
				...nextResponse.data.items.map((playlist) => {
					return {
						name: playlist.name,
						description: playlist.description,
						owner_name: playlist.owner.display_name,
						id: playlist.id,
					}
				})
			);

			playlists.next = nextResponse.data.next;
		}

		return res.status(200).send(playlists);
	} catch (error) {
		logger.error('getUserPlaylists', { error });
		return res.sendStatus(500);
	}
}

/**
 * Retrieve single playlist
 * @param {typedefs.Req} req 
 * @param {typedefs.Res} res 
 */
const getPlaylistDetails = async (req, res) => {
	try {
		/** @type {typedefs.Playlist} */
		let playlist = {};

		const response = await axiosInstance.get(
			"/playlists/" + req.query.playlist_id,
			{
				headers: { ...req.authHeader }
			}
		);
		if (response.status === 401)
			return res.status(401).send(response.data);

		// TODO: this whole section needs to be DRYer
		// look into serializr
		playlist.uri = response.data.uri
		playlist.name = response.data.name
		playlist.description = response.data.description
		let { display_name, uri, id, ...rest } = response.data.owner
		playlist.owner = { display_name, uri, id }
		playlist.followers = response.data.followers
		playlist.total = response.data.tracks.total;
		playlist.next = response.data.tracks.next;

		playlist.tracks = response.data.tracks.items.map((playlist_track) => {
			return {
				added_at: playlist_track.added_at,
				track: {
					uri: playlist_track.track.uri,
					name: playlist_track.track.name,
					artists: playlist_track.track.artists.map((artist) => { return { name: artist.name } }),
					album: { name: playlist_track.track.album.name },
					is_local: playlist_track.track.is_local,
				}
			}
		});


		// keep getting batches of 50 till exhausted
		while (playlist.next) {
			const nextResponse = await axiosInstance.get(
				playlist.next, // absolute URL from previous response which has offset and limit params
				{
					headers: {
						...req.authHeader
					}
				}
			);
			if (nextResponse.status === 401)
				return res.status(401).send(nextResponse.data);

			playlist.tracks.push(
				...nextResponse.data.items.map((playlist_track) => {
					return {
						added_at: playlist_track.added_at,
						track: {
							uri: playlist_track.track.uri,
							name: playlist_track.track.name,
							artists: playlist_track.track.artists.map((artist) => { return { name: artist.name } }),
							album: { name: playlist_track.track.album.name },
							is_local: playlist_track.track.is_local,
						}
					}
				})
			);

			playlist.next = nextResponse.data.next;
		}

		return res.status(200).send(playlist);
	} catch (error) {
		logger.error('getPlaylistDetails', { error });
		return res.sendStatus(500);
	}
}

module.exports = {
	getUserPlaylists,
	getPlaylistDetails,
};