const typedefs = require("../typedefs");
const logger = require("../utils/logger")(module);

const { singleRequest } = require("./apiCall");
const { parseSpotifyLink } = require("../utils/spotifyURITransformer");
const myGraph = require("../utils/graph");

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
		const response = await singleRequest(req, res,
			"GET",
			`/users/${uID}/playlists`,
			{
				params: {
					offset: 0,
					limit: 50,
				},
			});
		if (!response.success) return;
		const respData = response.resp.data;

		currentPlaylists = respData.items.map(playlist => {
			return {
				playlistID: playlist.id,
				playlistName: playlist.name
			}
		});
		let nextURL = respData.next;

		// keep getting batches of 50 till exhausted
		while (nextURL) {
			const nextResp = await singleRequest(req, res, "GET", nextURL);
			if (!nextResp.success) return;
			const nextData = nextResp.resp.data;

			currentPlaylists.push(
				...nextData.items.map(playlist => {
					return {
						playlistID: playlist.id,
						playlistName: playlist.name
					}
				})
			);

			nextURL = nextData.next;
		}

		let oldPlaylists = await Playlists.findAll({
			attributes: ["playlistID"],
			raw: true,
			where: {
				userID: uID
			},
		});

		let toRemovePls, toAddPls;
		if (oldPlaylists.length) {
			// existing user
			const currentSet = new Set(currentPlaylists.map(pl => pl.playlistID));
			const oldSet = new Set(oldPlaylists.map(pl => pl.playlistID));

			// TODO: update playlist name
			toAddPls = currentPlaylists.filter(current => !oldSet.has(current.playlistID));
			toRemovePls = oldPlaylists.filter(old => !currentSet.has(old.playlistID));
		} else {
			// new user
			toAddPls = currentPlaylists;
			toRemovePls = [];
		}
		let toRemovePlIDs = toRemovePls.map(pl => pl.playlistID);

		let removedLinks = 0, cleanedUser = 0, updatedUser = [];

		if (toRemovePls.length) {
			// clean up any links dependent on the playlists
			removedLinks = await Links.destroy({
				where: {
					[Op.and]: [
						{ userID: uID },
						{
							[Op.or]: [
								{ from: { [Op.in]: toRemovePlIDs } },
								{ to: { [Op.in]: toRemovePlIDs } },
							]
						}
					]
				}
			})

			// only then remove
			cleanedUser = await Playlists.destroy({
				where: { playlistID: toRemovePlIDs }
			});
			if (cleanedUser !== toRemovePls.length) {
				res.sendStatus(500);
				logger.error("Could not remove all old playlists", { error: new Error("Playlists.destroy failed?") });
				return;
			}
		}

		if (toAddPls.length) {
			updatedUser = await Playlists.bulkCreate(
				toAddPls.map(pl => { return { ...pl, userID: uID } }),
				{ validate: true }
			);
			if (updatedUser.length !== toAddPls.length) {
				res.sendStatus(500);
				logger.error("Could not add all new playlists", { error: new Error("Playlists.bulkCreate failed?") });
				return;
			}
		}

		res.status(200).send({ removedLinks });
		logger.info("Updated user data", { delLinks: removedLinks, delPls: cleanedUser, addPls: updatedUser.length });
		return;
	} catch (error) {
		res.sendStatus(500);
		logger.error('updateUser', { error });
		return;
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

		res.status(200).send({
			playlists: currentPlaylists,
			links: currentLinks
		});
		logger.info("Fetched user data", { pls: currentPlaylists.length, links: currentLinks.length });
		return;
	} catch (error) {
		res.sendStatus(500);
		logger.error('fetchUser', { error });
		return;
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
				res.status(400).send({ message: "Link is not a playlist" });
				logger.warn("non-playlist link provided", { from: fromPl, to: toPl });

				return;
			}
		} catch (error) {
			res.status(400).send({ message: "Invalid Spotify playlist link" });
			logger.error("parseSpotifyLink", { error });
			return;
		}

		let playlists = await Playlists.findAll({
			attributes: ["playlistID"],
			raw: true,
			where: { userID: uID }
		});
		playlists = playlists.map(pl => pl.playlistID);

		// if playlists are unknown
		if (![fromPl, toPl].every(pl => playlists.includes(pl.id))) {
			res.sendStatus(404);
			logger.error("unknown playlists, resync");
			return;
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
			res.sendStatus(409);
			logger.error("link already exists");
			return;
		}

		const allLinks = await Links.findAll({
			attributes: ["from", "to"],
			raw: true,
			where: { userID: uID }
		});

		const newGraph = new myGraph(playlists, [...allLinks, { from: fromPl.id, to: toPl.id }]);

		if (newGraph.detectCycle()) {
			res.status(400).send({ message: "Proposed link cannot cause a cycle in the graph" });
			logger.error("potential cycle detected");
			return;
		}

		const newLink = await Links.create({
			userID: uID,
			from: fromPl.id,
			to: toPl.id
		});
		if (!newLink) {
			res.sendStatus(500);
			logger.error("Could not create link", { error: new Error("Links.create failed?") });
			return;
		}

		res.sendStatus(201);
		logger.info("Created link");
		return;
	} catch (error) {
		res.sendStatus(500);
		logger.error('createLink', { error });
		return;
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
				res.status(400).send({ message: "Link is not a playlist" });
				logger.warn("non-playlist link provided", { from: fromPl, to: toPl });
				return;
			}
		} catch (error) {
			res.status(400).send({ message: "Invalid Spotify playlist link" });
			logger.error("parseSpotifyLink", { error });
			return;
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
			res.sendStatus(409);
			logger.error("link does not exist");
			return;
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
			res.sendStatus(500);
			logger.error("Could not remove link", { error: new Error("Links.destroy failed?") });
			return;
		}

		res.sendStatus(200);
		logger.info("Deleted link");
		return;
	} catch (error) {
		res.sendStatus(500);
		logger.error('removeLink', { error });
		return;
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
 * CANNOT populate local files; Spotify API does not support it yet.
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
				res.status(400).send({ message: "Link is not a playlist" });
				logger.warn("non-playlist link provided", { from: fromPl, to: toPl });
				return;
			}
		} catch (error) {
			res.status(400).send({ message: "Invalid Spotify playlist link" });
			logger.error("parseSpotifyLink", { error });
			return;
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
			res.sendStatus(409);
			logger.error("link does not exist");
			return;
		}

		let checkFields = ["collaborative", "owner(id)"];

		const checkResp = await singleRequest(req, res,
			"GET",
			`/playlists/${fromPl.id}/`,
			{
				params: {
					fields: checkFields.join()
				},
			});
		if (!checkResp.success) return;

		const checkFromData = checkResp.resp.data;

		// editable = collaborative || user is owner
		if (checkFromData.collaborative !== true &&
			checkFromData.owner.id !== uID) {
			res.status(403).send({
				message: "You cannot edit this playlist, you must be owner/playlist must be collaborative"
			});
			logger.error("user cannot edit target playlist");
			return;
		}

		let initialFields = ["tracks(next,items(is_local,track(uri)))"];
		let mainFields = ["next", "items(is_local,track(uri))"];

		const fromResp = await singleRequest(req, res,
			"GET",
			`/playlists/${fromPl.id}/`,
			{
				params: {
					fields: initialFields.join()
				},
			});
		if (!fromResp.success) return;
		const fromData = fromResp.resp.data;

		let fromPlaylist = {};
		// varying fields again smh
		if (fromData.tracks.next) {
			fromPlaylist.next = new URL(fromData.tracks.next);
			fromPlaylist.next.searchParams.set("fields", mainFields.join());
			fromPlaylist.next = fromPlaylist.next.href;
		}
		fromPlaylist.tracks = fromData.tracks.items.map((playlist_item) => {
			return {
				is_local: playlist_item.is_local,
				uri: playlist_item.track.uri
			}
		});


		// keep getting batches of 50 till exhausted
		while (fromPlaylist.next) {
			const nextResp = await singleRequest(req, res,
				"GET", fromPlaylist.next);
			if (!nextResp.success) return;
			const nextData = nextResp.resp.data;

			fromPlaylist.tracks.push(
				...nextData.items.map((playlist_item) => {
					return {
						is_local: playlist_item.is_local,
						uri: playlist_item.track.uri
					}
				})
			);

			fromPlaylist.next = nextData.next;
		}

		delete fromPlaylist.next;

		const toResp = await singleRequest(req, res,
			"GET",
			`/playlists/${toPl.id}/`,
			{
				params: {
					fields: initialFields.join()
				},
			});
		if (!toResp.success) return;
		const toData = toResp.resp.data;

		let toPlaylist = {};
		// varying fields again smh
		if (toData.tracks.next) {
			toPlaylist.next = new URL(toData.tracks.next);
			toPlaylist.next.searchParams.set("fields", mainFields.join());
			toPlaylist.next = toPlaylist.next.href;
		}
		toPlaylist.tracks = toData.tracks.items.map((playlist_item) => {
			return {
				is_local: playlist_item.is_local,
				uri: playlist_item.track.uri
			}
		});

		// keep getting batches of 50 till exhausted
		while (toPlaylist.next) {
			const nextResp = await singleRequest(req, res,
				"GET", toPlaylist.next);
			if (!nextResp.success) return;
			const nextData = nextResp.resp.data;
			toPlaylist.tracks.push(
				...nextData.items.map((playlist_item) => {
					return {
						is_local: playlist_item.is_local,
						uri: playlist_item.track.uri
					}
				})
			);

			toPlaylist.next = nextData.next;
		}

		delete toPlaylist.next;

		const fromTrackURIs = fromPlaylist.tracks.map(track => track.uri);
		let toTrackURIs = toPlaylist.tracks.
			filter(track => !track.is_local). // API doesn't support adding local files to playlists yet
			filter(track => !fromTrackURIs.includes(track.uri)). // only ones missing from the 'from' playlist
			map(track => track.uri);

		const logNum = toTrackURIs.length;

		// append to end in batches of 100
		while (toTrackURIs.length) {
			const nextBatch = toTrackURIs.splice(0, 100);
			const addResponse = await singleRequest(req, res,
				"POST",
				`/playlists/${fromPl.id}/tracks`,
				{},
				{ uris: nextBatch }, false
			);
			if (!addResponse.success) return;
		}

		res.status(200).send({ message: `Added ${logNum} tracks.` });
		logger.info(`Backfilled ${logNum} tracks`);
		return;
	} catch (error) {
		res.sendStatus(500);
		logger.error('populateMissingInLink', { error });
		return;
	}
}

/**
 * Remove tracks from the link-tail playlist,
 * that are present in the link-tail playlist but not in the link-head playlist.
 *  
 * eg.
 * 
 * pl_a has tracks: a, b, c
 * 
 * pl_b has tracks: e, b, d, c, f, g
 * 
 * link from pl_a to pl_b exists
 * 
 * after pruneExcessInLink, pl_b will have tracks: b, c
 * 
 * @param {typedefs.Req} req
 * @param {typedefs.Res} res
 */
const pruneExcessInLink = async (req, res) => {
	try {
		const uID = req.session.user.id;

		let fromPl, toPl;
		try {
			fromPl = parseSpotifyLink(req.body["from"]);
			toPl = parseSpotifyLink(req.body["to"]);
			if (fromPl.type !== "playlist" || toPl.type !== "playlist") {
				res.status(400).send({ message: "Link is not a playlist" });
				logger.warn("non-playlist link provided", { from: fromPl, to: toPl });
				return
			}
		} catch (error) {
			res.status(400).send({ message: "Invalid Spotify playlist link" });
			logger.error("parseSpotifyLink", { error });
			return;
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
			res.sendStatus(409);
			logger.error("link does not exist");
			return
		}

		let checkFields = ["collaborative", "owner(id)"];

		const checkToResp = await singleRequest(req, res,
			"GET",
			`/playlists/${toPl.id}/`,
			{
				params: {
					fields: checkFields.join()
				},
			});

		if (!checkToResp.success) return;
		const checkToData = checkToResp.resp.data;

		// editable = collaborative || user is owner
		if (checkToData.collaborative !== true &&
			checkToData.owner.id !== uID) {
			res.status(403).send({
				message: "You cannot edit this playlist, you must be owner/playlist must be collaborative"
			});
			logger.error("user cannot edit target playlist");
			return;
		}

		let initialFields = ["snapshot_id", "tracks(next,items(is_local,track(uri)))"];
		let mainFields = ["next", "items(is_local,track(uri))"];

		const fromResp = await singleRequest(req, res,
			"GET",
			`/playlists/${fromPl.id}/`,
			{
				params: {
					fields: initialFields.join()
				},
			});
		if (!fromResp.success) return;
		const fromData = fromResp.resp.data;

		let fromPlaylist = {};
		// varying fields again smh
		fromPlaylist.snapshot_id = fromData.snapshot_id;
		if (fromData.tracks.next) {
			fromPlaylist.next = new URL(fromData.tracks.next);
			fromPlaylist.next.searchParams.set("fields", mainFields.join());
			fromPlaylist.next = fromPlaylist.next.href;
		}
		fromPlaylist.tracks = fromData.tracks.items.map((playlist_item) => {
			return {
				is_local: playlist_item.is_local,
				uri: playlist_item.track.uri
			}
		});

		// keep getting batches of 50 till exhausted
		while (fromPlaylist.next) {
			const nextResp = await singleRequest(req, res,
				"GET", fromPlaylist.next);
			if (!nextResp.success) return;
			const nextData = nextResp.resp.data;

			fromPlaylist.tracks.push(
				...nextData.items.map((playlist_item) => {
					return {
						is_local: playlist_item.is_local,
						uri: playlist_item.track.uri
					}
				})
			);

			fromPlaylist.next = nextData.next;
		}

		delete fromPlaylist.next;
		const toResp = await singleRequest(req, res,
			"GET",
			`/playlists/${toPl.id}/`,
			{
				params: {
					fields: initialFields.join()
				},
			});
		if (!toResp.success) return;
		const toData = toResp.resp.data;
		let toPlaylist = {};
		// varying fields again smh
		toPlaylist.snapshot_id = toData.snapshot_id;
		if (toData.tracks.next) {
			toPlaylist.next = new URL(toData.tracks.next);
			toPlaylist.next.searchParams.set("fields", mainFields.join());
			toPlaylist.next = toPlaylist.next.href;
		}
		toPlaylist.tracks = toData.tracks.items.map((playlist_item) => {
			return {
				is_local: playlist_item.is_local,
				uri: playlist_item.track.uri
			}
		});

		// keep getting batches of 50 till exhausted
		while (toPlaylist.next) {
			const nextResp = await singleRequest(req, res,
				"GET", toPlaylist.next);
			if (!nextResp.success) return;
			const nextData = nextResp.resp.data;

			toPlaylist.tracks.push(
				...nextData.items.map((playlist_item) => {
					return {
						is_local: playlist_item.is_local,
						uri: playlist_item.track.uri
					}
				})
			);

			toPlaylist.next = nextData.next;
		}

		delete toPlaylist.next;

		const fromTrackURIs = fromPlaylist.tracks.map(track => track.uri);
		let indexedToTrackURIs = toPlaylist.tracks;

		indexedToTrackURIs.forEach((track, index) => {
			track.position = index;
		});

		let indexes = indexedToTrackURIs.filter(track => !fromTrackURIs.includes(track.uri)); // only those missing from the 'from' playlist
		indexes = indexes.map(track => track.position); // get track positions

		const logNum = indexes.length;

		// remove in batches of 100 (from reverse, to preserve positions while modifying)
		let currentSnapshot = toPlaylist.snapshot_id;
		while (indexes.length) {
			const nextBatch = indexes.splice(Math.max(indexes.length - 100, 0), 100);
			const delResponse = await singleRequest(req, res,
				"DELETE",
				`/playlists/${toPl.id}/tracks`,
				{},
				// axios delete method doesn't have separate arg for body so hv to put it in config
				{ positions: nextBatch, snapshot_id: currentSnapshot }, true
			)
			if (!delResponse.success) return;
			currentSnapshot = delResponse.resp.data.snapshot_id;
		}

		res.status(200).send({ message: `Removed ${logNum} tracks.` });
		logger.info(`Pruned ${logNum} tracks`);
		return;
	} catch (error) {
		res.sendStatus(500);
		logger.error('pruneExcessInLink', { error });
		return;
	}
}

module.exports = {
	updateUser,
	fetchUser,
	createLink,
	removeLink,
	populateMissingInLink,
	pruneExcessInLink,
};
