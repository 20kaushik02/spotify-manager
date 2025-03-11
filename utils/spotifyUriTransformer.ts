import type { URIObject } from "spotify_manager/index.d.ts";

const base62Pattern: RegExp = /^[A-Za-z0-9]+$/;

/**
 * Returns type and ID from a Spotify URI
 * @see {@link https://developer.spotify.com/documentation/web-api/concepts/spotify-uris-ids|Spotify URIs and IDs}
 * @param uri Spotify URI - can be of an album, track, playlist, user, episode, etc.
 * @throws {TypeError} If the input is not a valid Spotify URI
 */
const parseSpotifyURI = (uri: string): URIObject => {
  const parts = uri.split(":");

  if (parts[0] !== "spotify") {
    throw new TypeError(`${uri} is not a valid Spotify URI`);
  }

  let type = parts[1] ?? "";

  // Local file format: spotify:local:<artist>:<album>:<title>:<duration>
  if (type === "local") {
    let idParts = parts.slice(2);
    if (idParts.length !== 4) {
      throw new TypeError(`${uri} is not a valid local file URI`);
    }

    // URL decode artist, album, and title
    // NOTE: why do i have to do non-null assertion here...
    const artist = decodeURIComponent(idParts[0] ?? "");
    const album = decodeURIComponent(idParts[1] ?? "");
    const title = decodeURIComponent(idParts[2] ?? "");
    let duration = parseInt(idParts[3] ?? "", 10);

    let uriObj: URIObject = {
      type: "track",
      is_local: true,
      artist,
      album,
      title,
      id: "",
    };
    if (!isNaN(duration)) {
      uriObj.duration = duration;
    }
    // throw new TypeError(`${uri} has an invalid duration`);

    return uriObj;
  } else {
    // Not a local file
    if (parts.length !== 3) {
      throw new TypeError(`${uri} is not a valid Spotify URI`);
    }

    const id = parts[2] ?? "";

    if (!base62Pattern.test(id)) {
      throw new TypeError(`${uri} has an invalid ID`);
    }

    return { type, is_local: false, id };
  }
};

/**
 * Returns type and ID from a Spotify link
 * @param {string} link Spotify URL - can be of an album, track, playlist, user, episode, etc.
 * @throws {TypeError} If the input is not a valid Spotify link
 */
const parseSpotifyLink = (link: string): URIObject => {
  const localPattern =
    /^https:\/\/open\.spotify\.com\/local\/([^\/]*)\/([^\/]*)\/([^\/]+)\/(\d+)$/;
  const standardPattern = /^https:\/\/open\.spotify\.com\/([^\/]+)\/([^\/?]+)/;

  if (localPattern.test(link)) {
    // Local file format: https://open.spotify.com/local/artist/album/title/duration
    const matches = link.match(localPattern);
    if (!matches) {
      throw new TypeError(`${link} is not a valid Spotify local file link`);
    }

    // URL decode artist, album, and title
    const artist = decodeURIComponent(matches[1] ?? "");
    const album = decodeURIComponent(matches[2] ?? "");
    const title = decodeURIComponent(matches[3] ?? "");
    const duration = parseInt(matches[4] ?? "", 10);

    if (isNaN(duration)) {
      throw new TypeError(`${link} has an invalid duration`);
    }

    return {
      type: "track",
      is_local: true,
      artist,
      album,
      title,
      duration,
      id: "",
    };
  } else if (standardPattern.test(link)) {
    // Not a local file
    const matches = link.match(standardPattern);
    if (!matches || matches.length < 3) {
      throw new TypeError(`${link} is not a valid Spotify link`);
    }

    const type = matches[1] ?? "";
    const id = matches[2] ?? "";

    if (!base62Pattern.test(id)) {
      throw new TypeError(`${link} has an invalid ID`);
    }

    return { type, is_local: false, id };
  } else {
    throw new TypeError(`${link} is not a valid Spotify link`);
  }
};

/** Builds URI string from a URIObject */
const buildSpotifyURI = (uriObj: URIObject): string => {
  if (uriObj.is_local) {
    const artist = encodeURIComponent(uriObj.artist ?? "");
    const album = encodeURIComponent(uriObj.album ?? "");
    const title = encodeURIComponent(uriObj.title ?? "");
    const duration = uriObj.duration ? uriObj.duration.toString() : "";
    return `spotify:local:${artist}:${album}:${title}:${duration}`;
  }
  return `spotify:${uriObj.type}:${uriObj.id}`;
};

/** Builds link from a URIObject */
const buildSpotifyLink = (uriObj: URIObject): string => {
  if (uriObj.is_local) {
    const artist = encodeURIComponent(uriObj.artist ?? "");
    const album = encodeURIComponent(uriObj.album ?? "");
    const title = encodeURIComponent(uriObj.title ?? "");
    const duration = uriObj.duration ? uriObj.duration.toString() : "";
    return `https://open.spotify.com/local/${artist}/${album}/${title}/${duration}`;
  }
  return `https://open.spotify.com/${uriObj.type}/${uriObj.id}`;
};

export { parseSpotifyLink, parseSpotifyURI, buildSpotifyLink, buildSpotifyURI };
