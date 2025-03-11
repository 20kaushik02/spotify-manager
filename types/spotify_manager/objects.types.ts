import type {
  AlbumType,
  AvailableMarkets,
  CopyrightObject,
  ExternalIDs,
  ExternalURLs,
  Followers,
  ImageObject,
  LinkedFrom,
  Pagination,
  Restrictions,
} from "./common.types.ts";

// OBJECTS
export interface SimplifiedArtistObject {
  external_urls: ExternalURLs;
  href: string;
  id: string;
  name: string;
  type: "artist";
  uri: string;
}
export interface ArtistObject extends SimplifiedArtistObject {
  followers: Followers;
  genres: string[];
  images: ImageObject[];
  popularity: number;
}
export interface SimplifiedAlbumObject {
  album_type: AlbumType;
  artists: SimplifiedArtistObject[];
  available_markets: AvailableMarkets;
  external_urls: ExternalURLs;
  // genres: string[]; // deprecated
  href: string;
  id: string;
  images: ImageObject[];
  name: string;
  release_date: string;
  release_date_precision: "year" | "month" | "day";
  restrictions?: Restrictions;
  total_tracks: number;
  type: "album";
  uri: string;
}
export interface ArtistsAlbumObject extends SimplifiedAlbumObject {
  album_group: "album" | "single" | "compilation" | "appears_on";
}
export interface AlbumObject extends SimplifiedAlbumObject {
  copyrights: CopyrightObject[];
  external_ids: ExternalIDs;
  label: string;
  popularity: number;
  tracks: Pagination<SimplifiedTrackObject>;
}
export type SavedAlbumObject = {
  added_at: string;
  album: AlbumObject;
};
export interface SimplifiedEpisodeObject {
  description: string;
  html_description: string;
  duration_ms: number;
  explicit: boolean;
  external_urls: ExternalURLs;
  href: string;
  id: string;
  images: ImageObject[];
  is_externally_hosted: boolean;
  is_playable: boolean;
  languages: string[];
  name: string;
  release_date: string;
  release_date_precision: string;
  type: "episode";
  uri: string;
  restrictions?: Restrictions;
}
export interface EpisodeObject extends SimplifiedEpisodeObject {
  show: ShowObject;
}
export type SavedEpisodeObject = {
  added_at: string;
  episode: EpisodeObject;
};
export interface SimplifiedShowObject {
  available_markets?: AvailableMarkets;
  copyrights?: CopyrightObject[];
  description?: string;
  html_description?: string;
  explicit?: boolean;
  external_urls?: ExternalURLs;
  href?: string;
  id?: string;
  images?: ImageObject[];
  is_externally_hosted?: boolean;
  languages?: string[];
  media_type?: string;
  name?: string;
  publisher?: string;
  type: "show";
  uri?: string;
  total_episodes?: number;
}
export interface ShowObject extends SimplifiedShowObject {
  episodes?: Pagination<SimplifiedEpisodeObject>;
}
export type SavedShowObject = {
  added_at?: string;
  show?: SimplifiedShowObject;
};
export interface SimplifiedTrackObject {
  artists: SimplifiedArtistObject[];
  available_markets: AvailableMarkets;
  disc_number: number;
  duration_ms: number;
  explicit: boolean;
  external_urls: ExternalURLs;
  href: string;
  id: string;
  is_playable?: boolean;
  linked_from?: LinkedFrom;
  restrictions?: Restrictions;
  name: string;
  // preview_url?: string; // deprecated
  track_number: number;
  type: "track";
  uri: string;
  is_local: boolean;
}
export interface TrackObject extends SimplifiedTrackObject {
  album: SimplifiedAlbumObject;
  external_ids: ExternalIDs;
  popularity: number;
}
export type SavedTrackObject = {
  added_at: string;
  track: TrackObject;
};
export interface SimplifiedUserObject {
  display_name: string | null;
  external_urls: ExternalURLs;
  followers: Followers;
  href: string;
  id: string;
  images: ImageObject[];
  type: "user";
  uri: string;
}

export interface UserObject extends SimplifiedUserObject {
  country?: string;
  email?: string;
  explicit_content?: {
    filter_enabled: boolean;
    filter_locked: boolean;
  };
  product?: string;
}
export type PlaylistTrackObject = {
  added_at: string | null;
  added_by: SimplifiedUserObject | null;
  is_local: boolean;
  track: TrackObject | EpisodeObject;
};
interface BasePlaylistObject {
  collaborative: boolean;
  description: string | null;
  external_urls: ExternalURLs;
  href: string;
  id: string;
  images: ImageObject[];
  name: string;
  owner: SimplifiedUserObject;
  public: boolean | null;
  snapshot_id: string;
  type: "playlist";
  uri: string;
}
export interface SimplifiedPlaylistObject extends BasePlaylistObject {
  tracks: {
    href: string;
    total: number;
  };
}
export interface PlaylistObject extends BasePlaylistObject {
  tracks: Pagination<PlaylistTrackObject>;
  followers: Followers;
}
