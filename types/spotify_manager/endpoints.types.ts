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

// TODO: the data that actually gets retrieved from Spotify
// depends on the fields I pass as parameters to the API
// so... technically all fields are optional? but that's so
// horrible...

// GET method
// Albums
export type GetAlbumData = AlbumObject;
export type GetSeveralAlbumsData = { albums: AlbumObject[] };
export type GetAlbumTracksData = Pagination<SimplifiedTrackObject>;
export type GetUsersSavedAlbumsData = Pagination<SavedAlbumObject>;
export type CheckUsersSavedAlbumsData = boolean[];
export type GetNewReleasesData = { albums: Pagination<SimplifiedAlbumObject> };

// Artists
export type GetArtistData = ArtistObject;
export type GetSeveralArtistsData = { artists: ArtistObject[] };
export type GetArtistsAlbumsData = Pagination<ArtistsAlbumObject>;
export type GetArtistsTopTracksData = { tracks: TrackObject[] };

// Episodes
export type GetEpisodeData = EpisodeObject;
export type GetSeveralEpisodesData = { episodes: EpisodeObject[] };
export type GetUsersSavedEpisodesData = Pagination<SavedEpisodeObject>;

// Shows
export type GetShowData = ShowObject;
export type GetSeveralShowsData = { shows: SimplifiedShowObject[] };
export type GetShowEpisodesData = Pagination<SimplifiedEpisodeObject>;
export type GetUsersSavedShowsData = Pagination<SavedShowObject>;

// Playlists
export type GetPlaylistData = PlaylistObject;
export type GetPlaylistItemsData = Pagination<PlaylistTrackObject>;
export type GetCurrentUsersPlaylistsData = Pagination<SimplifiedPlaylistObject>;
export type GetUsersPlaylistsData = Pagination<SimplifiedPlaylistObject>;
export type GetPlaylistCoverImageData = ImageObject[];

// Tracks
export type GetTrackData = TrackObject;
export type GetSeveralTracksData = { tracks: TrackObject[] };
export type GetUsersSavedTracksData = Pagination<SavedTrackObject>;
export type CheckUsersSavedTracksData = boolean[];

// Users
export type GetCurrentUsersProfileData = UserObject;
export type GetUsersTopItemsData =
  | Pagination<ArtistObject>
  | Pagination<TrackObject>;
export type GetUsersProfileData = SimplifiedUserObject;
export type GetFollowedArtistsData = {
  artists: PaginationByCursor<ArtistObject>;
};
export type CheckIfUserFollowsArtistsOrNotData = boolean[];
export type CheckIfCurrentUserFollowsPlaylistData = boolean[];

// POST method
// Albums
// Artists
// Episodes
// Shows

// Playlists
export type AddItemsToPlaylistData = { snapshot_id: string };
export type CreatePlaylistData = PlaylistObject;

// Tracks
// Users

// PUT method
// Albums
export type SaveAlbumsForCurrentUserData = {};
// Artists
// Episodes
// Shows

// Playlists
export type ChangePlaylistDetailsData = {};
export type UpdatePlaylistItemsData = { snapshot_id: string };
export type AddCustomPlaylistCoverImageData = {};

// Tracks
export type SaveTracksForCurrentUserData = {};

// Users
export type FollowPlaylistData = {};
export type FollowArtistsOrUsersData = {};

// DELETE method
// Albums
export type RemoveUsersSavedAlbumsData = {};

// Artists
// Episodes
// Shows

// Playlists
export type RemovePlaylistItemsData = { snapshot_id: string };

// Tracks
export type RemoveUsersSavedTracksData = {};

// Users
export type UnfollowPlaylistData = {};
export type UnfollowArtistsOrUsersData = {};

// <insert other method> method
// Albums
// Artists
// Episodes
// Shows
// Playlists
// Tracks
// Users
