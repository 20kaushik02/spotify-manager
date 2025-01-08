const typedefs = require("../typedefs");
const logger = require("../utils/logger")(module);

const { getUserPlaylistsFirstPage, getUserPlaylistsNextPage, getPlaylistDetailsFirstPage, getPlaylistDetailsNextPage, addItemsToPlaylist, removeItemsFromPlaylist, checkPlaylistEditable } = require("../api/spotify");

const { parseSpotifyLink } = require("../utils/spotifyURITransformer");
const { randomBool, sleep } = require("../utils/flake");
const myGraph = require("../utils/graph");

const { Op } = require("sequelize");
const { sequelize } = require("../models");
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
    const respData = await getUserPlaylistsFirstPage(req, res);
    if (res.headersSent) return;

    currentPlaylists = respData.items.map(playlist => {
      return {
        playlistID: playlist.id,
        playlistName: playlist.name
      }
    });
    let nextURL = respData.next;

    // keep getting batches of 50 till exhausted
    while (nextURL) {
      const nextData = await getUserPlaylistsNextPage(req, res, nextURL);
      if (res.headersSent) return;

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
      attributes: ["playlistID", "playlistName"],
      raw: true,
      where: {
        userID: uID
      },
    });

    const deleted = [];
    const added = [];
    const renamed = [];

    if (oldPlaylists.length) {
      const oldMap = new Map(oldPlaylists.map((p) => [p.playlistID, p]));
      const currentMap = new Map(currentPlaylists.map((p) => [p.playlistID, p]));

      // Check for added and renamed playlists
      currentPlaylists.forEach((pl) => {
        const oldPlaylist = oldMap.get(pl.playlistID);

        if (!oldPlaylist) {
          added.push(pl);
        } else if (oldPlaylist.playlistName !== pl.playlistName) {
          // Renamed playlists
          renamed.push({
            playlistID: pl.playlistID,
            oldName: oldPlaylist.playlistName,
            newName: pl.playlistName,
          });
        }
      });

      // Check for deleted playlists
      oldPlaylists.forEach((pl) => {
        if (!currentMap.has(pl.playlistID)) {
          deleted.push(pl);
        }
      });
    } else {
      // new user
      added.push(...currentPlaylists);
    }

    let removedLinks = 0, delNum = 0, updateNum = 0, addPls = [];

    const deletedIDs = deleted.map(pl => pl.playlistID);
    if (deleted.length) {
      // clean up any links dependent on the playlists
      removedLinks = await Links.destroy({
        where: {
          [Op.and]: [
            { userID: uID },
            {
              [Op.or]: [
                { from: { [Op.in]: deletedIDs } },
                { to: { [Op.in]: deletedIDs } },
              ]
            }
          ]
        }
      })

      // only then remove
      delNum = await Playlists.destroy({
        where: { playlistID: deletedIDs, userID: uID }
      });
      if (delNum !== deleted.length) {
        res.status(500).send({ message: "Internal Server Error" });
        logger.warn("Could not remove all old playlists", { error: new Error("Playlists.destroy failed?") });
        return;
      }
    }

    if (added.length) {
      addPls = await Playlists.bulkCreate(
        added.map(pl => { return { ...pl, userID: uID } }),
        { validate: true }
      );
      if (addPls.length !== added.length) {
        res.status(500).send({ message: "Internal Server Error" });
        logger.error("Could not add all new playlists", { error: new Error("Playlists.bulkCreate failed?") });
        return;
      }
    }

    const transaction = await sequelize.transaction();
    try {
      for (const { playlistID, newName } of renamed) {
        const updateRes = await Playlists.update(
          { playlistName: newName },
          { where: { playlistID, userID: uID } },
          { transaction }
        );
        updateNum += Number(updateRes[0]);
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      res.status(500).send({ message: "Internal Server Error" });
      logger.error("Could not update playlist names", { error: new Error("Playlists.update failed?") });
      return;
    }

    res.status(200).send({ message: "Updated user data.", removedLinks: removedLinks > 0 });
    logger.debug("Updated user data", {
      delLinks: removedLinks,
      delPls: delNum,
      addPls: addPls.length,
      updatedPls: updateNum
    });
    return;
  } catch (error) {
    res.status(500).send({ message: "Internal Server Error" });
    logger.error("updateUser", { error });
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
    // if (randomBool(0.5)) {
    // 	res.status(404).send({ message: "Not Found" });
    // 	return;
    // }
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
    logger.debug("Fetched user data", { pls: currentPlaylists.length, links: currentLinks.length });
    return;
  } catch (error) {
    res.status(500).send({ message: "Internal Server Error" });
    logger.error("fetchUser", { error });
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
    // await sleep(1000);
    const uID = req.session.user.id;

    let fromPl, toPl;
    try {
      fromPl = parseSpotifyLink(req.body.from);
      toPl = parseSpotifyLink(req.body.to);
      if (fromPl.type !== "playlist" || toPl.type !== "playlist") {
        res.status(400).send({ message: "Link is not a playlist" });
        logger.info("non-playlist link provided", { from: fromPl, to: toPl });
        return;
      }
    } catch (error) {
      res.status(400).send({ message: "Could not parse link" });
      logger.warn("parseSpotifyLink", { error });
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
      res.status(404).send({ message: "Playlists out of sync." });
      logger.warn("unknown playlists, resync");
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
      res.status(409).send({ message: "Link already exists!" });
      logger.info("link already exists");
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
      logger.warn("potential cycle detected");
      return;
    }

    const newLink = await Links.create({
      userID: uID,
      from: fromPl.id,
      to: toPl.id
    });
    if (!newLink) {
      res.status(500).send({ message: "Internal Server Error" });
      logger.error("Could not create link", { error: new Error("Links.create failed?") });
      return;
    }

    res.status(201).send({ message: "Created link." });
    logger.debug("Created link");
    return;
  } catch (error) {
    res.status(500).send({ message: "Internal Server Error" });
    logger.error("createLink", { error });
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
      fromPl = parseSpotifyLink(req.body.from);
      toPl = parseSpotifyLink(req.body.to);
      if (fromPl.type !== "playlist" || toPl.type !== "playlist") {
        res.status(400).send({ message: "Link is not a playlist" });
        logger.info("non-playlist link provided", { from: fromPl, to: toPl });
        return;
      }
    } catch (error) {
      res.status(400).send({ message: "Could not parse link" });
      logger.warn("parseSpotifyLink", { error });
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
      res.status(409).send({ message: "Link does not exist!" });
      logger.warn("link does not exist");
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
      res.status(500).send({ message: "Internal Server Error" });
      logger.error("Could not remove link", { error: new Error("Links.destroy failed?") });
      return;
    }

    res.status(200).send({ message: "Deleted link." });
    logger.debug("Deleted link");
    return;
  } catch (error) {
    res.status(500).send({ message: "Internal Server Error" });
    logger.error("removeLink", { error });
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
const populateSingleLink = async (req, res) => {
  try {
    let fromPl, toPl;
    const link = { from: req.body.from, to: req.body.to };
    const uID = req.session.user.id;

    try {
      fromPl = parseSpotifyLink(link.from);
      toPl = parseSpotifyLink(link.to);
      if (fromPl.type !== "playlist" || toPl.type !== "playlist") {
        res.status(400).send({ message: "Link is not a playlist" });
        logger.info("non-playlist link provided", link);
        return;
      }
    } catch (error) {
      res.status(400).send({ message: "Could not parse link" });
      logger.warn("parseSpotifyLink", { error });
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
      res.status(409).send({ message: "Link does not exist!" });
      logger.warn("link does not exist", { link });
      return;
    }

    if (!await checkPlaylistEditable(req, res, fromPl.id, uID))
      return;

    let initialFields = ["tracks(next,items(is_local,track(uri)))"];
    let mainFields = ["next", "items(is_local,track(uri))"];

    const fromData = await getPlaylistDetailsFirstPage(req, res, initialFields.join(), fromPl.id);
    if (res.headersSent) return;

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
      const nextData = await getPlaylistDetailsNextPage(req, res, fromPlaylist.next);
      if (res.headersSent) return;

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

    const toData = await getPlaylistDetailsFirstPage(req, res, initialFields.join(), toPl.id);
    if (res.headersSent) return;

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
      const nextData = await getPlaylistDetailsNextPage(req, res, toPlaylist.next);
      if (res.headersSent) return;

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

    const toAddNum = toTrackURIs.length;
    const localNum = toPlaylist.tracks.filter(track => track.is_local).length;

    // append to end in batches of 100
    while (toTrackURIs.length > 0) {
      const nextBatch = toTrackURIs.splice(0, 100);
      const addData = await addItemsToPlaylist(req, res, nextBatch, fromPl.id);
      if (res.headersSent) return;
    }

    let logMsg;
    logMsg = toAddNum > 0 ? "Added " + toAddNum + " tracks" : "No tracks to add";
    logMsg += localNum > 0 ? ", but could not add " + localNum + " local files" : ".";

    res.status(200).send({ message: logMsg });
    logger.debug(logMsg);
    return;
  } catch (error) {
    res.status(500).send({ message: "Internal Server Error" });
    logger.error("populateSingleLink", { error });
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
 * after pruneSingleLink, pl_b will have tracks: b, c
 *
 * @param {typedefs.Req} req
 * @param {typedefs.Res} res
 */
const pruneSingleLink = async (req, res) => {
  try {
    const uID = req.session.user.id;
    const link = { from: req.body.from, to: req.body.to };

    let fromPl, toPl;
    try {
      fromPl = parseSpotifyLink(link.from);
      toPl = parseSpotifyLink(link.to);
      if (fromPl.type !== "playlist" || toPl.type !== "playlist") {
        res.status(400).send({ message: "Link is not a playlist" });
        logger.info("non-playlist link provided", link);
        return;
      }
    } catch (error) {
      res.status(400).send({ message: error.message });
      logger.warn("parseSpotifyLink", { error });
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
      res.status(409).send({ message: "Link does not exist!" });
      logger.warn("link does not exist", { link });
      return;
    }

    if (!await checkPlaylistEditable(req, res, toPl.id, uID))
      return;

    let initialFields = ["snapshot_id", "tracks(next,items(is_local,track(uri)))"];
    let mainFields = ["next", "items(is_local,track(uri))"];

    const fromData = await getPlaylistDetailsFirstPage(req, res, initialFields.join(), fromPl.id);
    if (res.headersSent) return;

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
      const nextData = await getPlaylistDetailsNextPage(req, res, fromPlaylist.next);
      if (res.headersSent) return;

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

    const toData = await getPlaylistDetailsFirstPage(req, res, initialFields.join(), toPl.id);
    if (res.headersSent) return;

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
      const nextData = await getPlaylistDetailsNextPage(req, res, toPlaylist.next);
      if (res.headersSent) return;

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

    const toDelNum = indexes.length;

    // remove in batches of 100 (from reverse, to preserve positions while modifying)
    let currentSnapshot = toPlaylist.snapshot_id;
    while (indexes.length) {
      const nextBatch = indexes.splice(Math.max(indexes.length - 100, 0), 100);
      const delResponse = await removeItemsFromPlaylist(req, res, nextBatch, toPl.id, currentSnapshot);
      if (res.headersSent) return;
      currentSnapshot = delResponse.snapshot_id;
    }

    res.status(200).send({ message: `Removed ${toDelNum} tracks.` });
    logger.debug(`Pruned ${toDelNum} tracks`);
    return;
  } catch (error) {
    res.status(500).send({ message: "Internal Server Error" });
    logger.error("pruneSingleLink", { error });
    return;
  }
}

module.exports = {
  updateUser,
  fetchUser,
  createLink,
  removeLink,
  populateSingleLink,
  pruneSingleLink,
};
