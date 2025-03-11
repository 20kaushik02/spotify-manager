import type {
  ImageObject,
  Pagination,
  PaginationByCursor,
} from "./common.types.ts";
import type {
  AlbumObject,
  ArtistObject,
  ArtistsAlbumObject,
  EpisodeObject,
  PlaylistObject,
  PlaylistTrackObject,
  SavedAlbumObject,
  SavedEpisodeObject,
  SavedShowObject,
  SavedTrackObject,
  ShowObject,
  SimplifiedAlbumObject,
  SimplifiedEpisodeObject,
  SimplifiedPlaylistObject,
  SimplifiedShowObject,
  SimplifiedTrackObject,
  SimplifiedUserObject,
  TrackObject,
  UserObject,
} from "./objects.types.ts";

// GET method
// Albums
export type GetAlbum = AlbumObject;
export type GetSeveralAlbums = { albums: AlbumObject[] };
export type GetAlbumTracks = Pagination<SimplifiedTrackObject>;
export type GetUsersSavedAlbums = Pagination<SavedAlbumObject>;
export type CheckUsersSavedAlbums = boolean[];
export type GetNewReleases = { albums: Pagination<SimplifiedAlbumObject> };

// Artists
export type GetArtist = ArtistObject;
export type GetSeveralArtists = { artists: ArtistObject[] };
export type GetArtistsAlbums = Pagination<ArtistsAlbumObject>;
export type GetArtistsTopTracks = { tracks: TrackObject[] };

// Episodes
export type GetEpisode = EpisodeObject;
export type GetSeveralEpisodes = { episodes: EpisodeObject[] };
export type GetUsersSavedEpisodes = Pagination<SavedEpisodeObject>;

// Shows
export type GetShow = ShowObject;
export type GetSeveralShows = { shows: SimplifiedShowObject[] };
export type GetShowEpisodes = Pagination<SimplifiedEpisodeObject>;
export type GetUsersSavedShows = Pagination<SavedShowObject>;

// Playlists
export type GetPlaylist = PlaylistObject;
export type GetPlaylistItems = Pagination<PlaylistTrackObject>;
export type GetCurrentUsersPlaylists = Pagination<SimplifiedPlaylistObject>;
export type GetUsersPlaylists = GetCurrentUsersPlaylists;
export type GetPlaylistCoverImage = ImageObject[];

// Tracks
export type GetTrack = TrackObject;
export type GetSeveralTracks = { tracks: TrackObject[] };
export type GetUsersSavedTracks = Pagination<SavedTrackObject>;
export type CheckUsersSavedTracks = boolean[];

// Users
export type GetCurrentUsersProfile = UserObject;
export type GetUsersTopItems =
  | Pagination<ArtistObject>
  | Pagination<TrackObject>;
export type GetUsersProfile = SimplifiedUserObject;
export type GetFollowedArtists = { artists: PaginationByCursor<ArtistObject> };
export type CheckIfUserFollowsArtistsOrNot = boolean[];
export type CheckIfCurrentUserFollowsPlaylist = boolean[];

// POST method
// Albums
// Artists
// Episodes
// Shows

// Playlists
export type AddItemsToPlaylist = { snapshot_id: string };
export type CreatePlaylist = PlaylistObject;

// Tracks
// Users

// PUT method
// Albums
export type SaveAlbumsForCurrentUser = {};
// Artists
// Episodes
// Shows

// Playlists
export type ChangePlaylistDetails = {};
export type UpdatePlaylistItems = { snapshot_id: string };
export type AddCustomPlaylistCoverImage = {};

// Tracks
export type SaveTracksForCurrentUser = {};

// Users
export type FollowPlaylist = {};
export type FollowArtistsOrUsers = {};

// DELETE method
// Albums
export type RemoveUsersSavedAlbums = {};

// Artists
// Episodes
// Shows

// Playlists
export type RemovePlaylistItems = { snapshot_id: string };

// Tracks
export type RemoveUsersSavedTracks = {};

// Users
export type UnfollowPlaylist = {};
export type UnfollowArtistsOrUsers = {};

// <insert other method> method
// Albums
// Artists
// Episodes
// Shows
// Playlists
// Tracks
// Users
