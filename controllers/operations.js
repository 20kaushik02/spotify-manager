const typedefs = require("../typedefs");
const logger = require("../utils/logger")(module);

const { axiosInstance } = require("../utils/axios");
const myGraph = require("../utils/graph");
const { parseSpotifyUri, parseSpotifyLink } = require("../utils/spotifyUriTransformer");


const { Op } = require("sequelize");
/** @type {typedefs.Model} */
const Playlists = require("../models").playlists;
/** @type {typedefs.Model} */
const Links = require("../models").links;

/**
 * Sync user's Spotify data
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

		currentPlaylists = response.data.items.map(playlist => {
			return {
				playlistID: parseSpotifyUri(playlist.uri).id,
				playlistName: playlist.name
			}
		});
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
				...nextResponse.data.items.map(playlist => {
					return {
						playlistID: parseSpotifyUri(playlist.uri).id,
						playlistName: playlist.name
					}
				})
			);

			nextURL = nextResponse.data.next;
		}

		let oldPlaylists = await Playlists.findAll({
			attributes: ["playlistID"],
			raw: true,
			where: {
				userID: userURI.id
			},
		});

		let toRemove, toAdd;
		if (oldPlaylists.length) {
			// existing user
			const currentSet = new Set(currentPlaylists.map(pl => pl.playlistID));
			const oldSet = new Set(oldPlaylists.map(pl => pl.playlistID));

			toAdd = currentPlaylists.filter(current => !oldSet.has(current.playlistID));
			toRemove = oldPlaylists.filter(old => !currentSet.has(old.playlistID));
		} else {
			// new user
			toAdd = currentPlaylists;
			toRemove = [];
		}
		let toRemoveIDs = toRemove.map(pl => pl.playlistID);
		let removedLinks = 0;

		if (toRemove.length) {
			// clean up any links dependent on the playlists
			removedLinks = await Links.destroy({
				where: {
					[Op.and]: [
						{ userID: userURI.id },
						{
							[Op.or]: [
								{ from: { [Op.in]: toRemoveIDs } },
								{ to: { [Op.in]: toRemoveIDs } },
							]
						}
					]
				}
			})

			// only then remove
			const cleanedUser = await Playlists.destroy({
				where: { playlistID: toRemoveIDs }
			});
			if (cleanedUser !== toRemove.length) {
				logger.error("Could not remove all old playlists", { error: new Error("Playlists.destroy failed?") });
				return res.sendStatus(500);
			}
		}

		if (toAdd.length) {
			const updatedUser = await Playlists.bulkCreate(
				toAdd.map(pl => { return { ...pl, userID: userURI.id } }),
				{ validate: true }
			);
			if (updatedUser.length !== toAdd.length) {
				logger.error("Could not add all new playlists", { error: new Error("Playlists.bulkCreate failed?") });
				return res.sendStatus(500);
			}
		}

		return res.status(200).send({ removedLinks });
	} catch (error) {
		logger.error('updateUser', { error });
		return res.sendStatus(500);
	}
}

/**
 * Fetch user's stored playlists and links
 * @param {typedefs.Req} req
 * @param {typedefs.Res} res
 */
const fetchUser = async (req, res) => {
	try {
		const userURI = parseSpotifyUri(req.session.user.uri);

		const currentPlaylists = await Playlists.findAll({
			attributes: ["playlistID", "playlistName"],
			raw: true,
			where: {
				userID: userURI.id
			},
		});

		const currentLinks = await Links.findAll({
			attributes: ["from", "to"],
			raw: true,
			where: {
				userID: userURI.id
			},
		});

		return res.status(200).send({
			playlists: currentPlaylists,
			links: currentLinks
		});
	} catch (error) {
		logger.error('fetchUser', { error });
		return res.sendStatus(500);
	}
}

/**
 * Create link between playlists!
 * @param {typedefs.Req} req
 * @param {typedefs.Res} res
 */
const createLink = async (req, res) => {
	try {
		const userURI = parseSpotifyUri(req.session.user.uri);

		let fromPl, toPl;
		try {
			fromPl = parseSpotifyLink(req.body["from"]);
			toPl = parseSpotifyLink(req.body["to"]);
			if (fromPl.type !== "playlist" || toPl.type !== "playlist") {
				return res.status(400).send({ message: "Invalid Spotify playlist link" });
			}
		} catch (error) {
			logger.error("parseSpotifyLink", { error });
			return res.status(400).send({ message: "Invalid Spotify playlist link" });
		}

		let playlists = await Playlists.findAll({
			attributes: ["playlistID"],
			raw: true,
			where: { userID: userURI.id }
		});
		playlists = playlists.map(pl => pl.playlistID);

		// if playlists are unknown
		if (![fromPl, toPl].every(pl => playlists.includes(pl.id))) {
			logger.error("unknown playlists, resync");
			return res.sendStatus(404);
		}

		// check if exists
		const existingLink = await Links.findOne({
			where: {
				[Op.and]: [
					{ userID: userURI.id },
					{ from: fromPl.id },
					{ to: toPl.id }
				]
			}
		});
		if (existingLink) {
			logger.error("link already exists");
			return res.sendStatus(409);
		}

		const allLinks = await Links.findAll({
			attributes: ["from", "to"],
			raw: true,
			where: { userID: userURI.id }
		});

		const newGraph = new myGraph(playlists, [...allLinks, { from: fromPl.id, to: toPl.id }]);

		if (newGraph.detectCycle()) {
			logger.error("potential cycle detected");
			return res.status(400).send({ message: "Proposed link cannot cause a cycle in the graph" });
		}

		const newLink = await Links.create({
			userID: userURI.id,
			from: fromPl.id,
			to: toPl.id
		});
		if (!newLink) {
			logger.error("Could not create link", { error: new Error("Links.create failed?") });
			return res.sendStatus(500);
		}

		return res.sendStatus(201);
	} catch (error) {
		logger.error('createLink', { error });
		return res.sendStatus(500);
	}
}


/**
 * Remove link between playlists
 * @param {typedefs.Req} req
 * @param {typedefs.Res} res
 */
const removeLink = async (req, res) => {
	try {
		const userURI = parseSpotifyUri(req.session.user.uri);

		let fromPl, toPl;
		try {
			fromPl = parseSpotifyLink(req.body["from"]);
			toPl = parseSpotifyLink(req.body["to"]);
			if (fromPl.type !== "playlist" || toPl.type !== "playlist") {
				return res.status(400).send({ message: "Invalid Spotify playlist link" });
			}
		} catch (error) {
			logger.error("parseSpotifyLink", { error });
			return res.status(400).send({ message: "Invalid Spotify playlist link" });
		}

		// check if exists
		const existingLink = await Links.findOne({
			where: {
				[Op.and]: [
					{ userID: userURI.id },
					{ from: fromPl.id },
					{ to: toPl.id }
				]
			}
		});
		if (!existingLink) {
			logger.error("link does not exist");
			return res.sendStatus(409);
		}

		const removedLink = await Links.destroy({
			where: {
				[Op.and]: [
					{ userID: userURI.id },
					{ from: fromPl.id },
					{ to: toPl.id }
				]
			}
		});
		if (!removedLink) {
			logger.error("Could not remove link", { error: new Error("Links.destroy failed?") });
			return res.sendStatus(500);
		}

		return res.sendStatus(200);
	} catch (error) {
		logger.error('removeLink', { error });
		return res.sendStatus(500);
	}
}

module.exports = {
	updateUser,
	fetchUser,
	createLink,
	removeLink
};
