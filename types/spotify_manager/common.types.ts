// COMMON
export type AlbumType = "album" | "single" | "compilation";
/**
 * The markets in which the album is available: {@link https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2|ISO 3166-1 alpha-2 country codes}
 *
 * NOTE: an album is considered available in a market when at least 1 of its tracks is available in that market.
 */
export type AvailableMarkets = string[];
export type CopyrightObject = {
  text: string;
  type: string;
};
export type ExternalURLs = {
  spotify: string;
};
export type ExternalIDs = {
  isrc: string;
  ean: string;
  upc: string;
};
export type Followers = {
  href: string | null;
  total: number;
};
export type ImageObject = {
  /** valid for 24 hours from retrieval */ url: string;
  /** in pixels */ height: number | null;
  /** in pixels */ width: number | null;
};
export type LinkedFrom = {
  external_urls?: ExternalURLs;
  href?: string;
  id?: string;
  type?: "track";
  uri?: string;
};
export type Pagination<T> = {
  href: string;
  limit: number;
  next: string | null;
  offset: number;
  previous: string | null;
  total: number;
  items: T[];
};
export type PaginationByCursor<T> = {
  href?: string;
  limit?: number;
  next?: string;
  cursors?: {
    after?: string;
    before?: string;
  };
  total?: number;
  items?: T[];
};
export type Restrictions = {
  reason: "market" | "product" | "explicit";
};
