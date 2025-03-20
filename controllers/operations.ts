import { Op } from "sequelize";

import {
  getCurrentUsersPlaylistsFirstPage,
  getCurrentUsersPlaylistsNextPage,
  getPlaylistDetailsFirstPage,
  getPlaylistDetailsNextPage,
  addItemsToPlaylist,
  removePlaylistItems,
  checkPlaylistEditable,
} from "../api/spotify.ts";

import type { RequestHandler } from "express";
import type { EndpointHandlerWithResArgs } from "spotify_manager/index.d.ts";

import seqConn from "../models/index.ts";

import myGraph from "../utils/graph.ts";
import { parseSpotifyLink } from "../utils/spotifyUriTransformer.ts";
// import { randomBool, sleep } from "../utils/flake.ts";

import { redisClient } from "../config/redis.ts";

// load db models
import Playlists from "../models/playlists.ts";
import Links from "../models/links.ts";

import logger from "../utils/logger.ts";

/**
 * Sync user's Spotify data
 */
const updateUser: RequestHandler = async (req, res) => {
  try {
    if (!req.session.user)
      throw new ReferenceError("session does not have user object");
    const { authHeaders } = req.session;
    if (!authHeaders)
      throw new ReferenceError("session does not have auth headers");
    const uID = req.session.user.id;

    type PlaylistCore = { playlistID: string; playlistName: string };
    let currentPlaylists: PlaylistCore[] = [];

    // get first 50
    const { resp } = await getCurrentUsersPlaylistsFirstPage({
      authHeaders,
      res,
    });
    if (!resp) return null;
    const respData = resp.data;

    currentPlaylists = respData.items.map((playlist) => {
      return {
        playlistID: playlist.id,
        playlistName: playlist.name,
      };
    });
    let nextURL = respData.next;

    // keep getting batches of 50 till exhausted
    while (nextURL) {
      const { resp } = await getCurrentUsersPlaylistsNextPage({
        authHeaders,
        res,
        nextURL,
      });
      if (!resp) return null;
      const nextData = resp.data;

      currentPlaylists.push(
        ...nextData.items.map((playlist) => {
          return {
            playlistID: playlist.id,
            playlistName: playlist.name,
          };
        })
      );

      nextURL = nextData.next;
    }

    let oldPlaylists: PlaylistCore[] = await Playlists.findAll({
      attributes: ["playlistID", "playlistName"],
      raw: true,
      where: {
        userID: uID,
      },
    });

    const deleted: PlaylistCore[] = [];
    const added: PlaylistCore[] = [];
    const renamed: { playlistID: string; oldName: string; newName: string }[] =
      [];

    if (oldPlaylists.length) {
      const oldMap = new Map(oldPlaylists.map((p) => [p.playlistID, p]));
      const currentMap = new Map(
        currentPlaylists.map((p) => [p.playlistID, p])
      );

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

    let removedLinks = 0,
      delNum = 0,
      updateNum = 0,
      addPls = [];

    const deletedIDs = deleted.map((pl) => pl.playlistID);
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
              ],
            },
          ],
        },
      });

      // only then remove
      delNum = await Playlists.destroy({
        where: { playlistID: deletedIDs, userID: uID },
      });
      if (delNum !== deleted.length) {
        res.status(500).send({ message: "Internal Server Error" });
        logger.error("Could not remove all old playlists");
        return null;
      }
    }

    if (added.length) {
      addPls = await Playlists.bulkCreate(
        added.map((pl) => {
          return { ...pl, userID: uID };
        }),
        { validate: true }
      );
      if (addPls.length !== added.length) {
        res.status(500).send({ message: "Internal Server Error" });
        logger.error("Could not add all new playlists");
        return null;
      }
    }

    try {
      await seqConn.transaction(async (transaction) => {
        for (const { playlistID, newName } of renamed) {
          const updateRes = await Playlists.update(
            { playlistName: newName },
            { where: { playlistID, userID: uID }, transaction }
          );
          updateNum += Number(updateRes[0]);
        }
      });
    } catch (error) {
      res.status(500).send({ message: "Internal Server Error" });
      logger.error("Could not update playlist names");
      return null;
    }

    res
      .status(200)
      .send({ message: "Updated user data.", removedLinks: removedLinks > 0 });
    logger.debug("Updated user data", {
      delLinks: removedLinks,
      delPls: delNum,
      addPls: addPls.length,
      updatedPls: updateNum,
    });
    return null;
  } catch (error) {
    res.status(500).send({ message: "Internal Server Error" });
    logger.error("updateUser", { error });
    return null;
  }
};

/**
 * Fetch user's stored playlists and links
 */
const fetchUser: RequestHandler = async (req, res) => {
  try {
    // if (randomBool(0.5)) {
    // 	res.status(404).send({ message: "Not Found" });
    // 	return null;
    // }
    if (!req.session.user)
      throw new ReferenceError("session does not have user object");
    const uID = req.session.user.id;

    const currentPlaylists = await Playlists.findAll({
      attributes: ["playlistID", "playlistName"],
      raw: true,
      where: {
        userID: uID,
      },
    });

    const currentLinks = await Links.findAll({
      attributes: ["from", "to"],
      raw: true,
      where: {
        userID: uID,
      },
    });

    res.status(200).send({
      playlists: currentPlaylists,
      links: currentLinks,
    });
    logger.debug("Fetched user data", {
      pls: currentPlaylists.length,
      links: currentLinks.length,
    });
    return null;
  } catch (error) {
    res.status(500).send({ message: "Internal Server Error" });
    logger.error("fetchUser", { error });
    return null;
  }
};

/**
 * Create link between playlists!
 */
const createLink: RequestHandler = async (req, res) => {
  try {
    // await sleep(1000);
    if (!req.session.user)
      throw new ReferenceError("session does not have user object");
    const uID = req.session.user.id;

    let fromPl, toPl;
    try {
      fromPl = parseSpotifyLink(req.body.from);
      toPl = parseSpotifyLink(req.body.to);
      if (fromPl.type !== "playlist" || toPl.type !== "playlist") {
        res.status(400).send({ message: "Links must be playlist links!" });
        logger.debug("non-playlist link provided");
        return null;
      }
    } catch (error) {
      res.status(400).send({ message: "Could not parse link" });
      logger.info("parseSpotifyLink", { error });
      return null;
    }

    const playlists = await Playlists.findAll({
      attributes: ["playlistID"],
      raw: true,
      where: { userID: uID },
    });
    const playlistIDs = playlists.map((pl) => pl.playlistID);

    // if playlists are unknown
    if (![fromPl, toPl].every((pl) => playlistIDs.includes(pl.id))) {
      res.status(404).send({ message: "Unknown playlists, resync first." });
      logger.debug("unknown playlists, resync");
      return null;
    }

    // check if exists
    const existingLink = await Links.findOne({
      where: {
        [Op.and]: [{ userID: uID }, { from: fromPl.id }, { to: toPl.id }],
      },
    });
    if (existingLink) {
      res.status(409).send({ message: "Link already exists!" });
      logger.debug("link already exists");
      return null;
    }

    const allLinks = await Links.findAll({
      attributes: ["from", "to"],
      raw: true,
      where: { userID: uID },
    });

    const newGraph = new myGraph(playlistIDs, [
      ...allLinks,
      { from: fromPl.id, to: toPl.id },
    ]);

    if (newGraph.detectCycle()) {
      res
        .status(400)
        .send({ message: "The link cannot cause a cycle in the graph." });
      logger.debug("potential cycle detected");
      return null;
    }

    const newLink = await Links.create({
      userID: uID,
      from: fromPl.id,
      to: toPl.id,
    });
    if (!newLink) {
      res.status(500).send({ message: "Internal Server Error" });
      logger.error("Could not create link");
      return null;
    }

    res.status(201).send({ message: "Created link." });
    logger.debug("Created link");
    return null;
  } catch (error) {
    res.status(500).send({ message: "Internal Server Error" });
    logger.error("createLink", { error });
    return null;
  }
};

/**
 * Remove link between playlists
 */
const removeLink: RequestHandler = async (req, res) => {
  try {
    if (!req.session.user)
      throw new ReferenceError("session does not have user object");
    const uID = req.session.user.id;

    let fromPl, toPl;
    try {
      fromPl = parseSpotifyLink(req.body.from);
      toPl = parseSpotifyLink(req.body.to);
      if (fromPl.type !== "playlist" || toPl.type !== "playlist") {
        res.status(400).send({ message: "Links must be playlist links!" });
        logger.debug("non-playlist link provided");
        return null;
      }
    } catch (error) {
      res.status(400).send({ message: "Could not parse link" });
      logger.info("parseSpotifyLink", { error });
      return null;
    }

    // check if exists
    const existingLink = await Links.findOne({
      where: {
        [Op.and]: [{ userID: uID }, { from: fromPl.id }, { to: toPl.id }],
      },
    });
    if (!existingLink) {
      res.status(409).send({ message: "Link does not exist!" });
      logger.debug("link does not exist");
      return null;
    }

    const removedLink = await Links.destroy({
      where: {
        [Op.and]: [{ userID: uID }, { from: fromPl.id }, { to: toPl.id }],
      },
    });
    if (!removedLink) {
      res.status(500).send({ message: "Internal Server Error" });
      logger.error("Could not remove link");
      return null;
    }

    res.status(200).send({ message: "Deleted link." });
    logger.debug("Deleted link");
    return null;
  } catch (error) {
    res.status(500).send({ message: "Internal Server Error" });
    logger.error("removeLink", { error });
    return null;
  }
};

type _TrackObj = { is_local: boolean; uri: string };
interface _GetPlaylistTracksArgs extends EndpointHandlerWithResArgs {
  playlistID: string;
}
interface _GetPlaylistTracks {
  tracks: _TrackObj[];
  snapshotID: string;
}
const _getPlaylistTracks: (
  opts: _GetPlaylistTracksArgs
) => Promise<_GetPlaylistTracks | null> = async ({
  res,
  authHeaders,
  playlistID,
}) => {
  // TODO: type this to indicate that only the requested fields are present
  const { resp: snapshotResp } = await getPlaylistDetailsFirstPage({
    res,
    authHeaders,
    initialFields: "snapshot_id",
    playlistID,
  });
  if (!snapshotResp) return null;

  const currentSnapshotID = snapshotResp.data.snapshot_id;

  // check cache
  const cachedSnapshotID = await redisClient.get(
    "playlist_snapshot:" + playlistID
  );
  if (cachedSnapshotID === currentSnapshotID) {
    const cachedTracksData = JSON.parse(
      (await redisClient.get("playlist_tracks:" + playlistID)) ?? "[]"
    ) as _TrackObj[];
    return { tracks: cachedTracksData, snapshotID: cachedSnapshotID };
  }
  let firstPageFields = ["tracks(next,items(is_local,track(uri)))"];
  let mainFields = ["next", "items(is_local,track(uri))"];

  const { resp: firstResp } = await getPlaylistDetailsFirstPage({
    res,
    authHeaders,
    initialFields: firstPageFields.join(),
    playlistID,
  });
  if (!firstResp) return null;
  const firstRespData = firstResp.data;

  const pl: _GetPlaylistTracks = {
    tracks: [],
    snapshotID: currentSnapshotID,
  };
  let nextURL;

  if (firstRespData.tracks.next) {
    nextURL = new URL(firstRespData.tracks.next);
    nextURL.searchParams.set("fields", mainFields.join());
    nextURL = nextURL.href;
  }
  pl.tracks = firstRespData.tracks.items.map((playlist_item) => {
    return {
      is_local: playlist_item.is_local,
      uri: playlist_item.track.uri,
    };
  });

  // keep getting batches of 50 till exhausted
  while (nextURL) {
    const { resp } = await getPlaylistDetailsNextPage({
      authHeaders,
      res,
      nextURL,
    });
    if (!resp) return null;
    const nextData = resp.data;

    pl.tracks.push(
      ...nextData.items.map((playlist_item) => {
        return {
          is_local: playlist_item.is_local,
          uri: playlist_item.track.uri,
        };
      })
    );

    nextURL = nextData.next;
  }

  // cache new data
  await redisClient.set("playlist_snapshot:" + playlistID, currentSnapshotID);
  await redisClient.set(
    "playlist_tracks:" + playlistID,
    JSON.stringify(pl.tracks)
  );

  return pl;
};

interface _TrackFilterArgs {
  /** link head playlist */
  from: _TrackObj[];
  /** link tail playlist */
  to: _TrackObj[];
}
type _PopulateFilter = { missing: string[]; localNum: number };
const _populateSingleLinkCore: (opts: _TrackFilterArgs) => _PopulateFilter = ({
  from,
  to,
}) => {
  const fromTrackURIs = from.map((track) => track.uri);
  let toTrackURIs = to
    .filter((track) => !track.is_local) // API doesn't support adding local files to playlists yet
    .filter((track) => !fromTrackURIs.includes(track.uri)) // only ones missing from the 'from' playlist
    .map((track) => track.uri);

  return {
    missing: toTrackURIs,
    localNum: to.filter((track) => track.is_local).length,
  };
};

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
 */
const populateSingleLink: RequestHandler = async (req, res) => {
  try {
    if (!req.session.user)
      throw new ReferenceError("session does not have user object");
    const uID = req.session.user.id;
    const { authHeaders } = req.session;
    if (!authHeaders)
      throw new ReferenceError("session does not have auth headers");
    const link = { from: req.body.from, to: req.body.to };
    let fromPl, toPl;

    try {
      fromPl = parseSpotifyLink(link.from);
      toPl = parseSpotifyLink(link.to);
      if (fromPl.type !== "playlist" || toPl.type !== "playlist") {
        res.status(400).send({ message: "Link is not a playlist" });
        logger.debug("non-playlist link provided", { link });
        return null;
      }
    } catch (error) {
      res.status(400).send({ message: "Could not parse link" });
      logger.info("parseSpotifyLink", { error });
      return null;
    }

    // check if exists
    const existingLink = await Links.findOne({
      where: {
        [Op.and]: [{ userID: uID }, { from: fromPl.id }, { to: toPl.id }],
      },
    });
    if (!existingLink) {
      res.status(409).send({ message: "Link does not exist!" });
      logger.debug("link does not exist", { link });
      return null;
    }

    const editableResp = await checkPlaylistEditable({
      res,
      authHeaders,
      playlistID: fromPl.id,
      userID: uID,
    });
    if (!editableResp.status) {
      res.status(403).send({ message: editableResp.message });
      logger.debug(editableResp.message, { editableResp });
      return null;
    }

    const fromTracks = await _getPlaylistTracks({
      res,
      authHeaders,
      playlistID: fromPl.id,
    });
    if (!fromTracks) return null;
    const toTracks = await _getPlaylistTracks({
      res,
      authHeaders,
      playlistID: toPl.id,
    });
    if (!toTracks) return null;

    const { missing, localNum } = _populateSingleLinkCore({
      from: fromTracks.tracks,
      to: toTracks.tracks,
    });
    const toAddNum = missing.length;

    // add in batches of 100
    let addedNum = 0;
    while (missing.length > 0) {
      const nextBatch = missing.splice(0, 100);
      const { resp } = await addItemsToPlaylist({
        authHeaders,
        nextBatch,
        playlistID: fromPl.id,
      });
      if (!resp) break;
      addedNum += nextBatch.length;
    }

    let message;
    message =
      toAddNum > 0 ? "Added " + addedNum + " tracks" : "No tracks to add";
    message +=
      addedNum < toAddNum
        ? ", failed to add " + (toAddNum - addedNum) + " tracks"
        : "";
    message += localNum > 0 ? ", skipped " + localNum + " local files" : ".";

    res.status(200).send({ message, toAddNum, addedNum, localNum });
    logger.debug(message, { toAddNum, addedNum, localNum });
    return null;
  } catch (error) {
    res.status(500).send({ message: "Internal Server Error" });
    logger.error("populateSingleLink", { error });
    return null;
  }
};

const populateChain: RequestHandler = async (req, res) => {
  try {
    if (!req.session.user)
      throw new ReferenceError("session does not have user object");
    const uID = req.session.user.id;
    const { authHeaders } = req.session;
    if (!authHeaders)
      throw new ReferenceError("session does not have auth headers");

    const { root } = req.body;
    let rootPl;
    try {
      rootPl = parseSpotifyLink(root);
      if (rootPl.type !== "playlist") {
        res.status(400).send({ message: "Link is not a playlist" });
        logger.debug("non-playlist link provided");
        return null;
      }
    } catch (error) {
      res.status(400).send({ message: "Could not parse link" });
      logger.info("parseSpotifyLink", { error });
      return null;
    }

    const playlists = await Playlists.findAll({
      attributes: ["playlistID"],
      raw: true,
      where: { userID: uID },
    });
    const playlistIDs = playlists.map((pl) => pl.playlistID);

    const allLinks = await Links.findAll({
      attributes: ["from", "to"],
      raw: true,
      where: { userID: uID },
    });

    // current idea: only add from the root, don't ripple-propagate
    const newGraph = new myGraph(playlistIDs, allLinks);
    const affectedPlaylists = newGraph.getAllHeads(rootPl.id);

    const editableStatuses = await Promise.all(
      affectedPlaylists.map((pl) => {
        return checkPlaylistEditable({
          res,
          authHeaders,
          playlistID: pl,
          userID: uID,
        });
      })
    );
    if (res.headersSent) return null; // error, resp sent and logged in singleRequest
    // else, respond with the non-editable playlists
    const nonEditablePlaylists = editableStatuses.filter(
      (statusObj) => statusObj.status === false
    );
    if (nonEditablePlaylists.length > 0) {
      let message =
        "Cannot edit one or more playlists: " +
        nonEditablePlaylists.map((pl) => pl.error?.playlistName).join(", ");
      res.status(403).send({ message });
      logger.debug(message, { nonEditablePlaylists });
      return null;
    }

    const affectedPlaylistsTracks = await Promise.all(
      affectedPlaylists.map((pl) => {
        return _getPlaylistTracks({ res, authHeaders, playlistID: pl });
      })
    );
    if (affectedPlaylistsTracks.some((plTracks) => !plTracks)) return null;

    const rootTracks = await _getPlaylistTracks({
      res,
      authHeaders,
      playlistID: rootPl.id,
    });
    if (!rootTracks) return null;

    const populateData = affectedPlaylistsTracks.map((plTracks) => {
      return _populateSingleLinkCore({
        from: plTracks!.tracks, // how to have the .some check recognized by typescript?
        to: rootTracks.tracks,
      });
    });

    // is map the best way to do this?
    // or should i use a for loop and break on error?
    const populateResult = await Promise.all(
      populateData.map(async ({ missing, localNum }, index) => {
        const toAddNum = missing.length;
        const playlistID = affectedPlaylists[index]!; // ...
        let addedNum = 0;
        while (missing.length > 0) {
          const nextBatch = missing.splice(0, 100);
          const { resp } = await addItemsToPlaylist({
            authHeaders,
            nextBatch,
            playlistID,
          });
          if (!resp) break;
          addedNum += nextBatch.length;
        }
        return { playlistID, toAddNum, addedNum, localNum };
      })
    );

    const reducedResult = populateResult.reduce(
      (acc, curr) => {
        return {
          toAddNum: acc.toAddNum + curr.toAddNum,
          addedNum: acc.addedNum + curr.addedNum,
          localNum: acc.localNum + curr.localNum,
        };
      },
      { toAddNum: 0, addedNum: 0, localNum: 0 }
    );

    let message;
    message = `There are ${populateResult.length} playlists up the chain.`;
    message +=
      reducedResult.toAddNum > 0
        ? " Added " + reducedResult.addedNum + " tracks"
        : " No tracks to add";
    message +=
      reducedResult.addedNum < reducedResult.toAddNum
        ? ", failed to add " +
          (reducedResult.toAddNum - reducedResult.addedNum) +
          " tracks"
        : "";
    message +=
      reducedResult.localNum > 0
        ? ", skipped " + reducedResult.localNum + " local files"
        : ".";

    res.status(200).send({ message, ...reducedResult });
    logger.debug(message, { ...reducedResult });
    return null;
  } catch (error) {
    res.status(500).send({ message: "Internal Server Error" });
    logger.error("populateChain", { error });
    return null;
  }
};

type _PruneFilter = { missingPositions: number[] };
const _pruneSingleLinkCore: (opts: _TrackFilterArgs) => _PruneFilter = ({
  from,
  to,
}) => {
  const fromTrackURIs = from.map((track) => track.uri);
  const indexedToTrackURIs = to.map((track, index) => {
    return { ...track, position: index };
  });

  let indexes = indexedToTrackURIs
    .filter((track) => !fromTrackURIs.includes(track.uri)) // only those missing from the 'from' playlist
    .map((track) => track.position); // get track positions

  return {
    missingPositions: indexes,
  };
};

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
 */
const pruneSingleLink: RequestHandler = async (req, res) => {
  try {
    if (!req.session.user)
      throw new ReferenceError("session does not have user object");
    const uID = req.session.user.id;
    const { authHeaders } = req.session;
    if (!authHeaders)
      throw new ReferenceError("session does not have auth headers");
    const link = { from: req.body.from, to: req.body.to };

    let fromPl, toPl;
    try {
      fromPl = parseSpotifyLink(link.from);
      toPl = parseSpotifyLink(link.to);
      if (fromPl.type !== "playlist" || toPl.type !== "playlist") {
        res.status(400).send({ message: "Link is not a playlist" });
        logger.debug("non-playlist link provided");
        return null;
      }
    } catch (error: any) {
      res.status(400).send({ message: error.message });
      logger.info("parseSpotifyLink", { error });
      return null;
    }

    // check if exists
    const existingLink = await Links.findOne({
      where: {
        [Op.and]: [{ userID: uID }, { from: fromPl.id }, { to: toPl.id }],
      },
    });
    if (!existingLink) {
      res.status(409).send({ message: "Link does not exist!" });
      logger.warn("link does not exist", { link });
      return null;
    }

    const editableResp = await checkPlaylistEditable({
      res,
      authHeaders,
      playlistID: toPl.id,
      userID: uID,
    });
    if (!editableResp.status) {
      res.status(403).send({ message: editableResp.message });
      logger.debug(editableResp.message, { editableResp });
      return null;
    }

    const fromTracks = await _getPlaylistTracks({
      res,
      authHeaders,
      playlistID: fromPl.id,
    });
    if (!fromTracks) return null;

    const toTracks = await _getPlaylistTracks({
      res,
      authHeaders,
      playlistID: toPl.id,
    });
    if (!toTracks) return null;

    const { missingPositions } = _pruneSingleLinkCore({
      from: fromTracks.tracks,
      to: toTracks.tracks,
    });

    const toDelNum = missingPositions.length;
    let deletedNum = 0;

    // remove in batches of 100 (from reverse, to preserve positions while modifying)
    let currentSnapshot = toTracks.snapshotID;
    while (missingPositions.length > 0) {
      const nextBatch = missingPositions.splice(
        Math.max(missingPositions.length - 100, 0),
        100
      );
      const { resp } = await removePlaylistItems({
        authHeaders,
        nextBatch,
        playlistID: toPl.id,
        snapshotID: currentSnapshot,
      });
      if (!resp) break;
      deletedNum += nextBatch.length;
      currentSnapshot = resp.data.snapshot_id;
    }

    let message;
    message =
      toDelNum > 0
        ? "Removed " + deletedNum + " tracks"
        : "No tracks to remove";
    message +=
      deletedNum < toDelNum
        ? ", failed to remove " + (toDelNum - deletedNum) + " tracks."
        : ".";

    res.status(200).send({ message, toDelNum, deletedNum });
    logger.debug(message, { toDelNum, deletedNum });
    return null;
  } catch (error) {
    res.status(500).send({ message: "Internal Server Error" });
    logger.error("pruneSingleLink", { error });
    return null;
  }
};

const pruneChain: RequestHandler = async (req, res) => {
  try {
    if (!req.session.user)
      throw new ReferenceError("session does not have user object");
    const uID = req.session.user.id;
    const { authHeaders } = req.session;
    if (!authHeaders)
      throw new ReferenceError("session does not have auth headers");

    const { root } = req.body;
    let rootPl;
    try {
      rootPl = parseSpotifyLink(root);
      if (rootPl.type !== "playlist") {
        res.status(400).send({ message: "Link is not a playlist" });
        logger.debug("non-playlist link provided");
        return null;
      }
    } catch (error) {
      res.status(400).send({ message: "Could not parse link" });
      logger.info("parseSpotifyLink", { error });
      return null;
    }

    const playlists = await Playlists.findAll({
      attributes: ["playlistID"],
      raw: true,
      where: { userID: uID },
    });
    const playlistIDs = playlists.map((pl) => pl.playlistID);

    const allLinks = await Links.findAll({
      attributes: ["from", "to"],
      raw: true,
      where: { userID: uID },
    });

    // current idea: only remove from the root, don't ripple-propagate
    const newGraph = new myGraph(playlistIDs, allLinks);
    const affectedPlaylists = newGraph.getAllTails(rootPl.id);

    const editableStatuses = await Promise.all(
      affectedPlaylists.map((pl) => {
        return checkPlaylistEditable({
          res,
          authHeaders,
          playlistID: pl,
          userID: uID,
        });
      })
    );
    if (res.headersSent) return null; // error, resp sent and logged in singleRequest
    // else, respond with the non-editable playlists
    const nonEditablePlaylists = editableStatuses.filter(
      (statusObj) => statusObj.status === false
    );
    if (nonEditablePlaylists.length > 0) {
      let message =
        "Cannot edit one or more playlists: " +
        nonEditablePlaylists.map((pl) => pl.error?.playlistName).join(", ");
      res.status(403).send({ message });
      logger.debug(message, { nonEditablePlaylists });
      return null;
    }

    const rootTracks = await _getPlaylistTracks({
      res,
      authHeaders,
      playlistID: rootPl.id,
    });
    if (!rootTracks) return null;

    const affectedPlaylistsTracks = await Promise.all(
      affectedPlaylists.map((pl) => {
        return _getPlaylistTracks({ res, authHeaders, playlistID: pl });
      })
    );
    if (affectedPlaylistsTracks.some((plTracks) => !plTracks)) return null;

    const pruneData = affectedPlaylistsTracks.map((plTracks) => {
      return _pruneSingleLinkCore({
        from: rootTracks.tracks,
        to: plTracks!.tracks, // how to have the .some check recognized by typescript?
      });
    });
    const pruneResult = await Promise.all(
      pruneData.map(async ({ missingPositions }, index) => {
        const toDelNum = missingPositions.length;
        const playlistID = affectedPlaylists[index]!; // ...
        let deletedNum = 0;
        let currentSnapshot = affectedPlaylistsTracks[index]!.snapshotID;
        while (missingPositions.length > 0) {
          const nextBatch = missingPositions.splice(
            Math.max(missingPositions.length - 100, 0),
            100
          );
          const { resp } = await removePlaylistItems({
            authHeaders,
            nextBatch,
            playlistID,
            snapshotID: currentSnapshot,
          });
          if (!resp) break;
          deletedNum += nextBatch.length;
          currentSnapshot = resp.data.snapshot_id;
        }
        return { playlistID, toDelNum, deletedNum };
      })
    );
    const reducedResult = pruneResult.reduce(
      (acc, curr) => {
        return {
          toDelNum: acc.toDelNum + curr.toDelNum,
          deletedNum: acc.deletedNum + curr.deletedNum,
        };
      },
      { toDelNum: 0, deletedNum: 0 }
    );

    let message;
    message = `There are ${pruneResult.length} playlists down the chain.`;
    message +=
      reducedResult.toDelNum > 0
        ? " Removed " + reducedResult.deletedNum + " tracks"
        : " No tracks to remove";
    message +=
      reducedResult.deletedNum < reducedResult.toDelNum
        ? ", failed to remove " +
          (reducedResult.toDelNum - reducedResult.deletedNum) +
          " tracks."
        : ".";

    res.status(200).send({ message, ...reducedResult });
    logger.debug(message, { ...reducedResult });
    return null;
  } catch (error) {
    res.status(500).send({ message: "Internal Server Error" });
    logger.error("pruneChain", { error });
    return null;
  }
};

export {
  updateUser,
  fetchUser,
  createLink,
  removeLink,
  populateSingleLink,
  populateChain,
  pruneSingleLink,
  pruneChain,
};
