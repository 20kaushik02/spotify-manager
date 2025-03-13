import {
  getCurrentUsersPlaylistsFirstPage,
  getCurrentUsersPlaylistsNextPage,
} from "../api/spotify.ts";

import type { RequestHandler } from "express";
import type {
  Pagination,
  SimplifiedPlaylistObject,
} from "spotify_manager/index.d.ts";

import logger from "../utils/logger.ts";

/**
 * Get user's playlists
 */
const fetchUserPlaylists: RequestHandler = async (req, res) => {
  try {
    const { authHeaders } = req.session;
    if (!authHeaders)
      throw new ReferenceError("session does not have auth headers");
    // get first 50
    const respData = await getCurrentUsersPlaylistsFirstPage({
      authHeaders,
      res,
    });
    if (!respData) return null;

    let tmpData = structuredClone(respData);
    const userPlaylists: Pick<
      Pagination<SimplifiedPlaylistObject>,
      "items" | "total"
    > = {
      items: [...tmpData.items],
      total: tmpData.total,
    };
    let nextURL = respData.next;
    // keep getting batches of 50 till exhausted
    while (nextURL) {
      const nextData = await getCurrentUsersPlaylistsNextPage({
        authHeaders,
        res,
        nextURL,
      });
      if (!nextData) return null;

      userPlaylists.items.push(...nextData.items);
      nextURL = nextData.next;
    }

    res.status(200).send(userPlaylists);
    logger.debug("Fetched user playlists", { num: userPlaylists.total });
    return null;
  } catch (error) {
    res.status(500).send({ message: "Internal Server Error" });
    logger.error("fetchUserPlaylists", { error });
    return null;
  }
};

export { fetchUserPlaylists };
