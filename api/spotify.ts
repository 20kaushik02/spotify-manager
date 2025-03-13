import { axiosInstance } from "./axios.ts";

import {
  type AxiosResponse,
  type AxiosRequestConfig,
  type RawAxiosRequestHeaders,
} from "axios";
import type {
  AddItemsToPlaylistData,
  EndpointHandlerBaseArgs,
  EndpointHandlerWithResArgs,
  GetCurrentUsersPlaylistsData,
  GetCurrentUsersProfileData,
  GetPlaylistData,
  GetPlaylistItemsData,
  RemovePlaylistItemsData,
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

type SingleRequestArgs = {
  /** Express response object. If set, send error responses from handler itself */
  res?: Res;
  /** mainly the `Authorization` header, could be extended later to account for custom headers, maybe rate-limiting stuff? */
  authHeaders: RawAxiosRequestHeaders;
  /** HTTP method */
  method?: allowedMethods;
  /** relative request path (from `/api/v1`) */
  path: string;
  /** request params, headers, etc. */
  config?: AxiosRequestConfig;
  /** request body */
  data?: any;
  /** true if `data` is to be placed inside config (say, axios' delete method) */
  inlineData?: boolean;
};

type SingleRequestResult<RespDataType> = Promise<{
  resp?: AxiosResponse<RespDataType, any>;
  error?: any;
  message: string;
}>;

/**
 * Spotify API (v1) - one-off request handler
 */
const singleRequest = async <RespDataType>({
  res,
  authHeaders,
  method = allowedMethods.Get,
  path,
  config = {},
  data = null,
  inlineData = false,
}: SingleRequestArgs): SingleRequestResult<RespDataType> => {
  let resp: AxiosResponse<RespDataType, any>;
  config.headers = { ...config.headers, ...authHeaders };
  try {
    if (!data || inlineData) {
      if (data) config.data = data ?? null;
      resp = await axiosInstance[method](path, config);
    } else {
      resp = await axiosInstance[method](path, data, config);
    }
    logger.debug(logPrefix + "Successful response received.");
    return { resp, message: "" };
  } catch (error: any) {
    let message = logPrefix;
    if (error.response) {
      // Non 2XX response received
      message = message.concat(
        `${error.response.status} - ${error.response.data?.message}`
      );
      res?.status(error.response.status).send(error.response.data);
      logger.warn(message, {
        response: {
          data: error.response.data,
          status: error.response.status,
        },
      });
      return { error, message };
    } else if (error.request) {
      // Request sent, but no response received
      message = message.concat("No response");
      res?.status(504).send({ message });
      logger.error(message, { error });
      return { error, message };
    } else {
      // Something happened in setting up the request that triggered an Error
      message = message.concat("Request failed");
      res?.status(500).send({ message: "Internal Server Error" });
      logger.error(message, { error });
      return { error, message };
    }
  }
};

interface GetCurrentUsersProfileArgs extends EndpointHandlerWithResArgs {}
type GetCurrentUsersProfile = SingleRequestResult<GetCurrentUsersProfileData>;
const getCurrentUsersProfile: (
  opts: GetCurrentUsersProfileArgs
) => GetCurrentUsersProfile = async ({ res, authHeaders }) => {
  return await singleRequest<GetCurrentUsersProfileData>({
    res,
    authHeaders,
    path: "/me",
  });
};

interface GetCurrentUsersPlaylistsFirstPageArgs
  extends EndpointHandlerWithResArgs {}
type GetCurrentUsersPlaylists =
  SingleRequestResult<GetCurrentUsersPlaylistsData>;
const getCurrentUsersPlaylistsFirstPage: (
  opts: GetCurrentUsersPlaylistsFirstPageArgs
) => GetCurrentUsersPlaylists = async ({ res, authHeaders }) => {
  return await singleRequest<GetCurrentUsersPlaylistsData>({
    res,
    authHeaders,
    path: `/me/playlists`,
    config: {
      params: {
        offset: 0,
        limit: 50,
      },
    },
  });
};

interface GetCurrentUsersPlaylistsNextPageArgs
  extends EndpointHandlerWithResArgs {
  nextURL: string;
}
const getCurrentUsersPlaylistsNextPage: (
  opts: GetCurrentUsersPlaylistsNextPageArgs
) => GetCurrentUsersPlaylists = async ({ res, authHeaders, nextURL }) => {
  return await singleRequest<GetCurrentUsersPlaylistsData>({
    res,
    authHeaders,
    path: nextURL,
  });
};

interface GetPlaylistDetailsFirstPageArgs extends EndpointHandlerWithResArgs {
  initialFields: string;
  playlistID: string;
}
type GetPlaylistDetailsFirstPage = SingleRequestResult<GetPlaylistData>;
const getPlaylistDetailsFirstPage: (
  opts: GetPlaylistDetailsFirstPageArgs
) => GetPlaylistDetailsFirstPage = async ({
  res,
  authHeaders,
  initialFields,
  playlistID,
}) => {
  return await singleRequest<GetPlaylistData>({
    authHeaders,
    res,
    path: `/playlists/${playlistID}/`,
    config: {
      params: {
        fields: initialFields,
      },
    },
  });
};

interface GetPlaylistDetailsNextPageArgs extends EndpointHandlerWithResArgs {
  nextURL: string;
}
type GetPlaylistItems = SingleRequestResult<GetPlaylistItemsData>;
const getPlaylistDetailsNextPage: (
  opts: GetPlaylistDetailsNextPageArgs
) => GetPlaylistItems = async ({ res, authHeaders, nextURL }) => {
  return await singleRequest<GetPlaylistItemsData>({
    res,
    authHeaders,
    path: nextURL,
  });
};

interface AddItemsToPlaylistArgs extends EndpointHandlerBaseArgs {
  nextBatch: string[];
  playlistID: string;
}
type AddItemsToPlaylist = SingleRequestResult<AddItemsToPlaylistData>;
const addItemsToPlaylist: (
  opts: AddItemsToPlaylistArgs
) => AddItemsToPlaylist = async ({ authHeaders, nextBatch, playlistID }) => {
  return await singleRequest<AddItemsToPlaylistData>({
    authHeaders,
    method: allowedMethods.Post,
    path: `/playlists/${playlistID}/tracks`,
    data: { uris: nextBatch },
    inlineData: false,
  });
};

interface RemovePlaylistItemsArgs extends EndpointHandlerBaseArgs {
  nextBatch: string[] | number[]; // see note below
  playlistID: string;
  snapshotID: string;
}
type RemovePlaylistItems = SingleRequestResult<RemovePlaylistItemsData>;
const removePlaylistItems: (
  opts: RemovePlaylistItemsArgs
) => RemovePlaylistItems = async ({
  authHeaders,
  nextBatch,
  playlistID,
  snapshotID,
}) => {
  // API doesn't document this kind of deletion via the 'positions' field
  // but see here: https://web.archive.org/web/20250313173723/https://github.com/spotipy-dev/spotipy/issues/95#issuecomment-2263634801
  return await singleRequest<RemovePlaylistItemsData>({
    authHeaders,
    method: allowedMethods.Delete,
    path: `/playlists/${playlistID}/tracks`,
    // axios delete method doesn't have separate arg for body so hv to put it in config
    data: { positions: nextBatch, snapshot_id: snapshotID },
    inlineData: true,
  });
};

// ---------
// non-endpoints, i.e. convenience wrappers
// ---------

interface CheckPlaylistEditableArgs extends EndpointHandlerWithResArgs {
  playlistID: string;
  userID: string;
}
type CheckPlaylistEditable = Promise<{
  status: boolean;
  error?: any;
  message: string;
}>;
const checkPlaylistEditable: (
  opts: CheckPlaylistEditableArgs
) => CheckPlaylistEditable = async ({
  res,
  authHeaders,
  playlistID,
  userID,
}) => {
  let checkFields = ["collaborative", "owner(id)"];
  const { resp, error, message } = await getPlaylistDetailsFirstPage({
    res,
    authHeaders,
    initialFields: checkFields.join(),
    playlistID,
  });
  if (!resp) return { status: false, error, message };

  // https://web.archive.org/web/20241226081630/https://developer.spotify.com/documentation/web-api/concepts/playlists#:~:text=A%20playlist%20can%20also%20be%20made%20collaborative
  // playlist is editable if it's collaborative (and thus private) or owned by the user
  if (resp.data.collaborative !== true && resp.data.owner.id !== userID) {
    return {
      status: false,
      error: { playlistID, playlistName: resp.data.name },
      message: "Cannot edit playlist: " + resp.data.name,
    };
  } else {
    return { status: true, message: "" };
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
