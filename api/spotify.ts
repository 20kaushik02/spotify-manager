import { axiosInstance } from "./axios.ts";

import { type AxiosResponse, type AxiosRequestConfig } from "axios";
import type {
  AddItemsToPlaylist,
  EndpointHandlerBaseArgs,
  GetCurrentUsersPlaylists,
  GetCurrentUsersProfile,
  GetPlaylist,
  GetPlaylistItems,
  RemovePlaylistItems,
  Req,
  Res,
} from "spotify_manager/index.d.ts";

import logger from "../utils/logger.ts";

const logPrefix = "Spotify API: ";
enum allowedMethods {
  Get = "get",
  Post = "post",
  Put = "put",
  Delete = "delete",
}

/**
 * Spotify API - one-off request handler
 * @param req convenient auto-placing headers from middleware (not a good approach?)
 * @param res handle failure responses here itself (not a good approach?)
 * @param method HTTP method
 * @param path request path
 * @param config request params, headers, etc.
 * @param data request body
 * @param inlineData true if `data` is to be placed inside config (say, axios' delete method)
 */
const singleRequest = async <RespDataType>(
  req: Req,
  res: Res,
  method: allowedMethods,
  path: string,
  config: AxiosRequestConfig = {},
  data: any = null,
  inlineData: boolean = false
): Promise<AxiosResponse<RespDataType, any> | null> => {
  let resp: AxiosResponse<RespDataType, any>;
  config.headers = { ...config.headers, ...req.session.authHeaders };
  try {
    if (!data || inlineData) {
      if (data) config.data = data ?? null;
      resp = await axiosInstance[method](path, config);
    } else {
      resp = await axiosInstance[method](path, data, config);
    }
    logger.debug(logPrefix + "Successful response received.");
    return resp;
  } catch (error: any) {
    if (error.response) {
      // Non 2XX response received
      let logMsg;
      if (error.response.status >= 400 && error.response.status < 600) {
        res.status(error.response.status).send(error.response.data);
        logMsg = "" + error.response.status;
      } else {
        res.sendStatus(error.response.status);
        logMsg = "???";
      }
      logger.warn(logPrefix + logMsg, {
        response: {
          data: error.response.data,
          status: error.response.status,
        },
      });
    } else if (error.request) {
      // No response received
      res.status(504).send({ message: "No response from Spotify" });
      logger.error(logPrefix + "No response", { error });
    } else {
      // Something happened in setting up the request that triggered an Error
      res.status(500).send({ message: "Internal Server Error" });
      logger.error(logPrefix + "Request failed?", { error });
    }

    return null;
  }
};

interface GetCurrentUsersProfileArgs extends EndpointHandlerBaseArgs {}
const getCurrentUsersProfile: (
  opts: GetCurrentUsersProfileArgs
) => Promise<GetCurrentUsersProfile | null> = async ({ req, res }) => {
  const response = await singleRequest<GetCurrentUsersProfile>(
    req,
    res,
    allowedMethods.Get,
    "/me",
    {
      headers: { Authorization: `Bearer ${req.session.accessToken}` },
    }
  );
  return response ? response.data : null;
};

interface GetCurrentUsersPlaylistsFirstPageArgs
  extends EndpointHandlerBaseArgs {}
const getCurrentUsersPlaylistsFirstPage: (
  opts: GetCurrentUsersPlaylistsFirstPageArgs
) => Promise<GetCurrentUsersPlaylists | null> = async ({ req, res }) => {
  const response = await singleRequest<GetCurrentUsersPlaylists>(
    req,
    res,
    allowedMethods.Get,
    `/me/playlists`,
    {
      params: {
        offset: 0,
        limit: 50,
      },
    }
  );
  return response?.data ?? null;
};

interface GetCurrentUsersPlaylistsNextPageArgs extends EndpointHandlerBaseArgs {
  nextURL: string;
}
const getCurrentUsersPlaylistsNextPage: (
  opts: GetCurrentUsersPlaylistsNextPageArgs
) => Promise<GetCurrentUsersPlaylists | null> = async ({
  req,
  res,
  nextURL,
}) => {
  const response = await singleRequest<GetCurrentUsersPlaylists>(
    req,
    res,
    allowedMethods.Get,
    nextURL
  );
  return response?.data ?? null;
};

interface GetPlaylistDetailsFirstPageArgs extends EndpointHandlerBaseArgs {
  initialFields: string;
  playlistID: string;
}
const getPlaylistDetailsFirstPage: (
  opts: GetPlaylistDetailsFirstPageArgs
) => Promise<GetPlaylist | null> = async ({
  req,
  res,
  initialFields,
  playlistID,
}) => {
  const response = await singleRequest<GetPlaylist>(
    req,
    res,
    allowedMethods.Get,
    `/playlists/${playlistID}/`,
    {
      params: {
        fields: initialFields,
      },
    }
  );
  return response?.data ?? null;
};

interface GetPlaylistDetailsNextPageArgs extends EndpointHandlerBaseArgs {
  nextURL: string;
}
const getPlaylistDetailsNextPage: (
  opts: GetPlaylistDetailsNextPageArgs
) => Promise<GetPlaylistItems | null> = async ({ req, res, nextURL }) => {
  const response = await singleRequest<GetPlaylistItems>(
    req,
    res,
    allowedMethods.Get,
    nextURL
  );
  return response?.data ?? null;
};

interface AddItemsToPlaylistArgs extends EndpointHandlerBaseArgs {
  nextBatch: string[];
  playlistID: string;
}
const addItemsToPlaylist: (
  opts: AddItemsToPlaylistArgs
) => Promise<AddItemsToPlaylist | null> = async ({
  req,
  res,
  nextBatch,
  playlistID,
}) => {
  const response = await singleRequest<AddItemsToPlaylist>(
    req,
    res,
    allowedMethods.Post,
    `/playlists/${playlistID}/tracks`,
    {},
    { uris: nextBatch },
    false
  );
  return response?.data ?? null;
};

interface RemovePlaylistItemsArgs extends EndpointHandlerBaseArgs {
  nextBatch: string[] | number[]; // see note below
  playlistID: string;
  snapshotID: string;
}
const removePlaylistItems: (
  opts: RemovePlaylistItemsArgs
) => Promise<RemovePlaylistItems | null> = async ({
  req,
  res,
  nextBatch,
  playlistID,
  snapshotID,
}) => {
  // API doesn't document this kind of deletion via the 'positions' field
  // but see here: https://github.com/spotipy-dev/spotipy/issues/95#issuecomment-2263634801
  const response = await singleRequest<RemovePlaylistItems>(
    req,
    res,
    allowedMethods.Delete,
    `/playlists/${playlistID}/tracks`,
    {},
    // axios delete method doesn't have separate arg for body so hv to put it in config
    { positions: nextBatch, snapshot_id: snapshotID },
    true
  );
  return response?.data ?? null;
};

// ---------
// non-endpoints, i.e. convenience wrappers
// ---------

interface CheckPlaylistEditableArgs extends EndpointHandlerBaseArgs {
  playlistID: string;
  userID: string;
}
const checkPlaylistEditable: (
  opts: CheckPlaylistEditableArgs
) => Promise<boolean> = async ({ req, res, playlistID, userID }) => {
  let checkFields = ["collaborative", "owner(id)"];

  const checkFromData = await getPlaylistDetailsFirstPage({
    req,
    res,
    initialFields: checkFields.join(),
    playlistID,
  });
  if (!checkFromData) return false;

  // https://web.archive.org/web/20241226081630/https://developer.spotify.com/documentation/web-api/concepts/playlists#:~:text=A%20playlist%20can%20also%20be%20made%20collaborative
  // playlist is editable if it's collaborative (and thus private) or owned by the user
  if (
    checkFromData.collaborative !== true &&
    checkFromData.owner?.id !== userID
  ) {
    res.status(403).send({
      message:
        "You cannot edit this playlist, you must be the owner/the playlist must be collaborative",
      playlistID,
    });
    logger.info("user cannot edit target playlist", { playlistID });
    return false;
  } else {
    return true;
  }
};

export {
  singleRequest,
  getCurrentUsersProfile,
  getCurrentUsersPlaylistsFirstPage,
  getCurrentUsersPlaylistsNextPage,
  getPlaylistDetailsFirstPage,
  getPlaylistDetailsNextPage,
  addItemsToPlaylist,
  removePlaylistItems,
  checkPlaylistEditable,
};
