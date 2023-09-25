const logger = require("../utils/logger")(module);

const typedefs = require("../typedefs");
const { axiosInstance } = require('../axios');

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

		playlists.items = response.data.items.map((playlist) => {
			return {
				name: playlist.name,
				description: playlist.description,
				owner: playlist.owner.display_name,
				images: playlist.images.map((image) => image.url),
				link: playlist.external_urls.spotify,
				collaborative: playlist.collaborative,
				public: playlist.public,
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

			playlists.items.push(
				...nextResponse.data.items.map((playlist) => {
					return {
						name: playlist.name,
						description: playlist.description,
						owner: playlist.owner.display_name,
						images: playlist.images.map((image) => image.url),
						link: playlist.external_urls.spotify,
						collaborative: playlist.collaborative,
						public: playlist.public,
						id: playlist.id,
					}
				})
			);

			playlists.next = nextResponse.data.next;
		}

		return res.status(200).send(playlists);
	} catch (error) {
		logger.error('Error', { error });
		return res.status(500).send({ message: "Server Error. Try again." });
	}
}

module.exports = {
	getUserPlaylists
};