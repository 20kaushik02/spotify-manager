const typedefs = require("../typedefs");
const logger = require("../utils/logger")(module);

const { axiosInstance } = require("../utils/axios");
const myGraph = require("../utils/graph");
const { parseSpotifyLink } = require("../utils/spotifyURITransformer");

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
		const uID = req.session.user.id;

		// get first 50
		const response = await axiosInstance.get(
			`/users/${uID}/playlists`,
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

		currentPlaylists = response.data.items.map(playlist => {
			return {
				playlistID: playlist.id,
				playlistName: playlist.name
			}
		});
		nextURL = response.data.next;

		// keep getting batches of 50 till exhausted
		while (nextURL) {
			const nextResponse = await axiosInstance.get(
				nextURL, // absolute URL from previous response which has params
				{ headers: req.sessHeaders }
			);
			if (response.status >= 400 && response.status < 500)
				return res.status(response.status).send(response.data);
			else if (response.status >= 500)
				return res.sendStatus(response.status);

			currentPlaylists.push(
				...nextResponse.data.items.map(playlist => {
					return {
						playlistID: playlist.id,
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
				userID: uID
			},
		});

		let toRemove, toAdd;
		if (oldPlaylists.length) {
			// existing user
			const currentSet = new Set(currentPlaylists.map(pl => pl.playlistID));
			const oldSet = new Set(oldPlaylists.map(pl => pl.playlistID));

			// TODO: update playlist name
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
						{ userID: uID },
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
				toAdd.map(pl => { return { ...pl, userID: uID } }),
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
		const uID = req.session.user.id;

		const currentPlaylists = await Playlists.findAll({
			attributes: ["playlistID", "playlistName"],
			raw: true,
			where: {
				userID: uID
			},
		});

		const currentLinks = await Links.findAll({
			attributes: ["from", "to"],
			raw: true,
			where: {
				userID: uID
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
		const uID = req.session.user.id;

		let fromPl, toPl;
		try {
			fromPl = parseSpotifyLink(req.body["from"]);
			toPl = parseSpotifyLink(req.body["to"]);
			if (fromPl.type !== "playlist" || toPl.type !== "playlist") {
				return res.status(400).send({ message: "Link is not a playlist" });
			}
		} catch (error) {
			logger.error("parseSpotifyLink", { error });
			return res.status(400).send({ message: "Invalid Spotify playlist link" });
		}

		let playlists = await Playlists.findAll({
			attributes: ["playlistID"],
			raw: true,
			where: { userID: uID }
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
					{ userID: uID },
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
			where: { userID: uID }
		});

		const newGraph = new myGraph(playlists, [...allLinks, { from: fromPl.id, to: toPl.id }]);

		if (newGraph.detectCycle()) {
			logger.error("potential cycle detected");
			return res.status(400).send({ message: "Proposed link cannot cause a cycle in the graph" });
		}

		const newLink = await Links.create({
			userID: uID,
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
		const uID = req.session.user.id;

		let fromPl, toPl;
		try {
			fromPl = parseSpotifyLink(req.body["from"]);
			toPl = parseSpotifyLink(req.body["to"]);
			if (fromPl.type !== "playlist" || toPl.type !== "playlist") {
				return res.status(400).send({ message: "Link is not a playlist" });
			}
		} catch (error) {
			logger.error("parseSpotifyLink", { error });
			return res.status(400).send({ message: "Invalid Spotify playlist link" });
		}

		// check if exists
		const existingLink = await Links.findOne({
			where: {
				[Op.and]: [
					{ userID: uID },
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
					{ userID: uID },
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

/**
 * Add tracks to the link-head playlist,
 * that are present in the link-tail playlist but not in the link-head playlist,
 * in the order that they are present in the link-tail playlist.
 * 
 * eg.
 * 
 * pl_a has tracks: a, b, c
 * 
 * pl_b has tracks: e, b, d
 * 
 * link from pl_a to pl_b exists
 * 
 * after populateMissingInLink, pl_a will have tracks: a, b, c, e, d
 * 
 * @param {typedefs.Req} req
 * @param {typedefs.Res} res
 */
const populateMissingInLink = async (req, res) => {
	try {
		const uID = req.session.user.id;

		let fromPl, toPl;
		try {
			fromPl = parseSpotifyLink(req.body["from"]);
			toPl = parseSpotifyLink(req.body["to"]);
			if (fromPl.type !== "playlist" || toPl.type !== "playlist") {
				return res.status(400).send({ message: "Link is not a playlist" });
			}
		} catch (error) {
			logger.error("parseSpotifyLink", { error });
			return res.status(400).send({ message: "Invalid Spotify playlist link" });
		}

		// check if exists
		const existingLink = await Links.findOne({
			where: {
				[Op.and]: [
					{ userID: uID },
					{ from: fromPl.id },
					{ to: toPl.id }
				]
			}
		});
		if (!existingLink) {
			logger.error("link does not exist");
			return res.sendStatus(409);
		}

		let checkFields = ["collaborative", "owner(id)"];
		const checkFromData = await axiosInstance.get(
			`/playlists/${fromPl.id}/`,
			{
				params: {
					fields: checkFields.join()
				},
				headers: req.sessHeaders
			}
		);
		if (checkFromData.status >= 400 && checkFromData.status < 500)
			return res.status(checkFromData.status).send(checkFromData.data);
		else if (checkFromData.status >= 500)
			return res.sendStatus(checkFromData.status);

		// editable = collaborative || user is owner
		if (checkFromData.data.collaborative !== true &&
			checkFromData.data.owner.id !== uID) {
			logger.error("user cannot edit target playlist");
			return res.status(403).send({
				message: "You cannot edit this playlist, you must be owner/ playlist must be collaborative"
			});
		}

		let initialFields = ["tracks(next,items(is_local,track(uri)))"];
		let mainFields = ["next", "items(is_local,track(uri))"];
		const fromData = await axiosInstance.get(
			`/playlists/${fromPl.id}/`,
			{
				params: {
					fields: initialFields.join()
				},
				headers: req.sessHeaders
			}
		);
		if (fromData.status >= 400 && fromData.status < 500)
			return res.status(fromData.status).send(fromData.data);
		else if (fromData.status >= 500)
			return res.sendStatus(fromData.status);

		let fromPlaylist = {};
		// varying fields again smh
		if (fromData.data.tracks.next) {
			fromPlaylist.next = new URL(fromData.data.tracks.next);
			fromPlaylist.next.searchParams.set("fields", mainFields.join());
			fromPlaylist.next = fromPlaylist.next.href;
		}
		fromPlaylist.tracks = fromData.data.tracks.items.map((playlist_item) => {
			return {
				is_local: playlist_item.is_local,
				uri: playlist_item.track.uri
			}
		});


		// keep getting batches of 50 till exhausted
		while (fromPlaylist.next) {
			const nextResponse = await axiosInstance.get(
				fromPlaylist.next, // absolute URL from previous response which has params
				{ headers: req.sessHeaders }
			);

			if (nextResponse.status >= 400 && nextResponse.status < 500)
				return res.status(nextResponse.status).send(nextResponse.data);
			else if (nextResponse.status >= 500)
				return res.sendStatus(nextResponse.status);

			fromPlaylist.tracks.push(
				...nextResponse.data.items.map((playlist_item) => {
					return {
						is_local: playlist_item.is_local,
						uri: playlist_item.track.uri
					}
				})
			);

			fromPlaylist.next = nextResponse.data.next;
		}

		delete fromPlaylist.next;
		const toData = await axiosInstance.get(
			`/playlists/${toPl.id}/`,
			{
				params: {
					fields: initialFields.join()
				},
				headers: req.sessHeaders
			}
		);
		if (toData.status >= 400 && toData.status < 500)
			return res.status(toData.status).send(toData.data);
		else if (toData.status >= 500)
			return res.sendStatus(toData.status);

		let toPlaylist = {};
		// varying fields again smh
		if (toData.data.tracks.next) {
			toPlaylist.next = new URL(toData.data.tracks.next);
			toPlaylist.next.searchParams.set("fields", mainFields.join());
			toPlaylist.next = toPlaylist.next.href;
		}
		toPlaylist.tracks = toData.data.tracks.items.map((playlist_item) => {
			return {
				is_local: playlist_item.is_local,
				uri: playlist_item.track.uri
			}
		});

		// keep getting batches of 50 till exhausted
		while (toPlaylist.next) {
			const nextResponse = await axiosInstance.get(
				toPlaylist.next, // absolute URL from previous response which has params
				{ headers: req.sessHeaders }
			);

			if (nextResponse.status >= 400 && nextResponse.status < 500)
				return res.status(nextResponse.status).send(nextResponse.data);
			else if (nextResponse.status >= 500)
				return res.sendStatus(nextResponse.status);

			toPlaylist.tracks.push(
				...nextResponse.data.items.map((playlist_item) => {
					return {
						is_local: playlist_item.is_local,
						uri: playlist_item.track.uri
					}
				})
			);

			toPlaylist.next = nextResponse.data.next;
		}

		delete toPlaylist.next;

		let fromURIs = fromPlaylist.tracks.map(track => track.uri);
		let toURIs = toPlaylist.tracks.
			filter(track => !track.is_local). // API doesn't support adding local files to playlists yet
			map(track => track.uri).
			filter(track => !fromURIs.includes(track)); // only ones missing from the 'from' playlist

		// add in batches of 100
		while (toURIs.length) {
			const nextBatch = toURIs.splice(0, 100);
			const addResponse = await axiosInstance.post(
				`/playlists/${fromPl.id}/tracks`,
				{ uris: nextBatch },
				{ headers: req.sessHeaders }
			);
			if (addResponse.status >= 400 && addResponse.status < 500)
				return res.status(addResponse.status).send(addResponse.data);
			else if (addResponse.status >= 500)
				return res.sendStatus(addResponse.status);
		}

		return res.sendStatus(200);
	} catch (error) {
		logger.error('populateMissingInLink', { error });
		return res.sendStatus(500);
	}
}

module.exports = {
	updateUser,
	fetchUser,
	createLink,
	removeLink,
	populateMissingInLink,
};
