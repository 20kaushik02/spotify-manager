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
import type {
  EndpointHandlerWithResArgs,
  LinkModel_Edge,
  PlaylistModel_Pl,
  URIObject,
} from "spotify_manager/index.d.ts";

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

    let currentPlaylists: PlaylistModel_Pl[] = [];

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

    let oldPlaylists = await Playlists.findAll({
      attributes: ["playlistID", "playlistName"],
      raw: true,
      where: {
        userID: uID,
      },
    });

    const deleted: PlaylistModel_Pl[] = [];
    const added: PlaylistModel_Pl[] = [];
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
        logger.error("Could not remove all old playlists", {
          error: new Error("Playlists.destroy failed?"),
        });
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
        logger.error("Could not add all new playlists", {
          error: new Error("Playlists.bulkCreate failed?"),
        });
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
      logger.error("Could not update playlist names", {
        error: new Error("Playlists.update failed?"),
      });
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
        res.status(400).send({ message: "Link is not a playlist" });
        logger.info("non-playlist link provided", { from: fromPl, to: toPl });
        return null;
      }
    } catch (error) {
      res.status(400).send({ message: "Could not parse link" });
      logger.warn("parseSpotifyLink", { error });
      return null;
    }

    const playlists = (await Playlists.findAll({
      attributes: ["playlistID"],
      raw: true,
      where: { userID: uID },
    })) as unknown as PlaylistModel_Pl[];
    const playlistIDs = playlists.map((pl) => pl.playlistID);

    // if playlists are unknown
    if (![fromPl, toPl].every((pl) => playlistIDs.includes(pl.id))) {
      res.status(404).send({ message: "Playlists out of sync." });
      logger.warn("unknown playlists, resync");
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
      logger.info("link already exists");
      return null;
    }

    const allLinks = (await Links.findAll({
      attributes: ["from", "to"],
      raw: true,
      where: { userID: uID },
    })) as unknown as LinkModel_Edge[];

    const newGraph = new myGraph(playlistIDs, [
      ...allLinks,
      { from: fromPl.id, to: toPl.id },
    ]);

    if (newGraph.detectCycle()) {
      res
        .status(400)
        .send({ message: "Proposed link cannot cause a cycle in the graph" });
      logger.warn("potential cycle detected");
      return null;
    }

    const newLink = await Links.create({
      userID: uID,
      from: fromPl.id,
      to: toPl.id,
    });
    if (!newLink) {
      res.status(500).send({ message: "Internal Server Error" });
      logger.error("Could not create link", {
        error: new Error("Links.create failed?"),
      });
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
        res.status(400).send({ message: "Link is not a playlist" });
        logger.info("non-playlist link provided", { from: fromPl, to: toPl });
        return null;
      }
    } catch (error) {
      res.status(400).send({ message: "Could not parse link" });
      logger.warn("parseSpotifyLink", { error });
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
      logger.warn("link does not exist");
      return null;
    }

    const removedLink = await Links.destroy({
      where: {
        [Op.and]: [{ userID: uID }, { from: fromPl.id }, { to: toPl.id }],
      },
    });
    if (!removedLink) {
      res.status(500).send({ message: "Internal Server Error" });
      logger.error("Could not remove link", {
        error: new Error("Links.destroy failed?"),
      });
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

interface _GetPlaylistTracksArgs extends EndpointHandlerWithResArgs {
  playlistID: string;
}
interface _GetPlaylistTracks {
  tracks: {
    is_local: boolean;
    uri: string;
  }[];
  snapshotID: string;
}
const _getPlaylistTracks: (
  opts: _GetPlaylistTracksArgs
) => Promise<_GetPlaylistTracks | null> = async ({
  authHeaders,
  res,
  playlistID,
}) => {
  let initialFields = ["snapshot_id,tracks(next,items(is_local,track(uri)))"];
  let mainFields = ["next", "items(is_local,track(uri))"];

  const { resp } = await getPlaylistDetailsFirstPage({
    authHeaders,
    res,
    initialFields: initialFields.join(),
    playlistID,
  });
  if (!resp) return null;
  const respData = resp.data;

  // check cache
  const cachedSnapshotID = await redisClient.get(
    "playlist_snapshot:" + playlistID
  );
  if (cachedSnapshotID === respData.snapshot_id) {
    const cachedTracksData = (await redisClient.json.get(
      "playlist_tracks:" + playlistID
    )) as _GetPlaylistTracks["tracks"];
    return { tracks: cachedTracksData, snapshotID: cachedSnapshotID };
  }

  const pl: _GetPlaylistTracks = {
    tracks: [],
    snapshotID: respData.snapshot_id,
  };
  let nextURL;

  if (respData.tracks.next) {
    nextURL = new URL(respData.tracks.next);
    nextURL.searchParams.set("fields", mainFields.join());
    nextURL = nextURL.href;
  }
  pl.tracks = respData.tracks.items.map((playlist_item) => {
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
  await redisClient.set(
    "playlist_snapshot:" + playlistID,
    respData.snapshot_id
  );
  await redisClient.json.set("playlist_tracks:" + playlistID, "$", pl.tracks);

  return pl;
};

interface _PopulateSingleLinkCoreArgs extends EndpointHandlerWithResArgs {
  link: {
    from: URIObject;
    to: URIObject;
  };
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
 */
const _populateSingleLinkCore: (opts: _PopulateSingleLinkCoreArgs) => Promise<{
  toAddNum: number;
  addedNum: number;
  localNum: number;
} | null> = async ({ res, authHeaders, link }) => {
  try {
    const fromPl = link.from,
      toPl = link.to;

    const fromPlaylist = await _getPlaylistTracks({
      res,
      authHeaders,
      playlistID: fromPl.id,
    });
    if (!fromPlaylist) return null;

    const toPlaylist = await _getPlaylistTracks({
      res,
      authHeaders,
      playlistID: toPl.id,
    });
    if (!toPlaylist) return null;

    const fromTrackURIs = fromPlaylist.tracks.map((track) => track.uri);
    let toTrackURIs = toPlaylist.tracks
      .filter((track) => !track.is_local) // API doesn't support adding local files to playlists yet
      .filter((track) => !fromTrackURIs.includes(track.uri)) // only ones missing from the 'from' playlist
      .map((track) => track.uri);

    const toAddNum = toTrackURIs.length;
    const localNum = toPlaylist.tracks.filter((track) => track.is_local).length;
    let addedNum = 0;

    // append to end in batches of 100
    while (toTrackURIs.length > 0) {
      const nextBatch = toTrackURIs.splice(0, 100);
      const { resp } = await addItemsToPlaylist({
        authHeaders,
        nextBatch,
        playlistID: fromPl.id,
      });
      if (!resp) break;
      addedNum += nextBatch.length;
    }

    return { toAddNum, addedNum, localNum };
  } catch (error) {
    res.status(500).send({ message: "Internal Server Error" });
    logger.error("_populateSingleLinkCore", { error });
    return null;
  }
};

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
        logger.info("non-playlist link provided", link);
        return null;
      }
    } catch (error) {
      res.status(400).send({ message: "Could not parse link" });
      logger.warn("parseSpotifyLink", { error });
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

    if (
      !(
        await checkPlaylistEditable({
          authHeaders,
          res,
          playlistID: fromPl.id,
          userID: uID,
        })
      ).status
    )
      return null;

    const result = await _populateSingleLinkCore({
      authHeaders,
      res,
      link: { from: fromPl, to: toPl },
    });
    if (result) {
      const { toAddNum, addedNum, localNum } = result;
      let message;
      message =
        toAddNum > 0 ? "Added " + addedNum + " tracks" : "No tracks to add";
      message +=
        addedNum < toAddNum
          ? ", failed to add " + (toAddNum - addedNum) + " tracks"
          : "";
      message += localNum > 0 ? ", skipped " + localNum + " local files" : ".";

      res.status(200).send({ message, toAddNum, addedNum, localNum });
      logger.debug(message, { toAddNum, localNum });
    }
    return null;
  } catch (error) {
    res.status(500).send({ message: "Internal Server Error" });
    logger.error("populateSingleLink", { error });
    return null;
  }
};

interface _PruneSingleLinkCoreArgs extends EndpointHandlerWithResArgs {
  link: { from: URIObject; to: URIObject };
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
 */
const _pruneSingleLinkCore: (
  opts: _PruneSingleLinkCoreArgs
) => Promise<{ toDelNum: number; deletedNum: number } | null> = async ({
  authHeaders,
  res,
  link,
}) => {
  try {
    const fromPl = link.from,
      toPl = link.to;

    const fromPlaylist = await _getPlaylistTracks({
      authHeaders,
      res,
      playlistID: fromPl.id,
    });
    if (!fromPlaylist) return null;

    const toPlaylist = await _getPlaylistTracks({
      authHeaders,
      res,
      playlistID: toPl.id,
    });
    if (!toPlaylist) return null;

    const fromTrackURIs = fromPlaylist.tracks.map((track) => track.uri);
    const indexedToTrackURIs = toPlaylist.tracks.map((track, index) => {
      return { ...track, position: index };
    });

    let indexes = indexedToTrackURIs
      .filter((track) => !fromTrackURIs.includes(track.uri)) // only those missing from the 'from' playlist
      .map((track) => track.position); // get track positions

    const toDelNum = indexes.length;
    let deletedNum = 0;

    // remove in batches of 100 (from reverse, to preserve positions while modifying)
    let currentSnapshot = toPlaylist.snapshotID;
    while (indexes.length > 0) {
      const nextBatch = indexes.splice(Math.max(indexes.length - 100, 0), 100);
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

    return { toDelNum, deletedNum };
  } catch (error) {
    res.status(500).send({ message: "Internal Server Error" });
    logger.error("_pruneSingleLinkCore", { error });
    return null;
  }
};

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
        logger.info("non-playlist link provided", link);
        return null;
      }
    } catch (error: any) {
      res.status(400).send({ message: error.message });
      logger.warn("parseSpotifyLink", { error });
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

    if (
      !(
        await checkPlaylistEditable({
          authHeaders,
          res,
          playlistID: toPl.id,
          userID: uID,
        })
      ).status
    )
      return null;

    const result = await _pruneSingleLinkCore({
      authHeaders,
      res,
      link: {
        from: fromPl,
        to: toPl,
      },
    });
    if (result) {
      const { toDelNum, deletedNum } = result;
      let message;
      message =
        toDelNum > 0
          ? "Removed " + deletedNum + " tracks"
          : "No tracks to remove";
      message +=
        deletedNum < toDelNum
          ? ", failed to remove " + (toDelNum - deletedNum) + " tracks"
          : ".";

      res.status(200).send({ message, toDelNum, deletedNum });
      logger.debug(message, { toDelNum, deletedNum });
    }
    return null;
  } catch (error) {
    res.status(500).send({ message: "Internal Server Error" });
    logger.error("pruneSingleLink", { error });
    return null;
  }
};

export {
  updateUser,
  fetchUser,
  createLink,
  removeLink,
  populateSingleLink,
  pruneSingleLink,
};
