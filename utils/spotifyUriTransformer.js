const typedefs = require("../typedefs");

/** @type {RegExp} */
const base62Pattern = /^[A-Za-z0-9]+$/;

/**
 * Returns type and ID from a Spotify URI
 * @see {@link https://developer.spotify.com/documentation/web-api/concepts/spotify-uris-ids|Spotify URIs and IDs}
 * @param {string} uri Spotify URI - can be of an album, track, playlist, user, episode, etc.
 * @returns {typedefs.UriObject}
 * @throws {TypeError} If the input is not a valid Spotify URI
 */
const parseSpotifyUri = (uri) => {
	const parts = uri.split(":");

	if (parts[0] !== "spotify") {
		throw new TypeError(`${uri} is not a valid Spotify URI`);
	}

	let type = parts[1];

	if (type === "local") {
		// Local file format: spotify:local:<artist>:<album>:<title>:<duration>
		let idParts = parts.slice(2);
		if (idParts.length < 4) {
			throw new TypeError(`${uri} is not a valid local file URI`);
		}

		// URL decode artist, album, and title
		const artist = decodeURIComponent(idParts[0] || '');
		const album = decodeURIComponent(idParts[1] || '');
		const title = decodeURIComponent(idParts[2]);
		const duration = parseInt(idParts[3], 10);

		if (isNaN(duration)) {
			throw new TypeError(`${uri} has an invalid duration`);
		}

		return { type: "track", is_local: true, artist, album, title, duration };
	} else {
		// Not a local file
		if (parts.length !== 3) {
			throw new TypeError(`${uri} is not a valid Spotify URI`);
		}

		const id = parts[2];

		if (!base62Pattern.test(id)) {
			throw new TypeError(`${uri} has an invalid ID`);
		}

		return { type, is_local: false, id };
	}
}

/**
 * Returns type and ID from a Spotify link
 * @see {@link https://developer.spotify.com/documentation/web-api/concepts/spotify-uris-ids|Spotify URIs and IDs}
 * @param {string} link Spotify URL - can be of an album, track, playlist, user, episode, etc.
 * @returns {typedefs.UriObject}
 * @throws {TypeError} If the input is not a valid Spotify link
 */
const parseSpotifyLink = (link) => {
	const localPattern = /^https:\/\/open\.spotify\.com\/local\/([^\/]*)\/([^\/]*)\/([^\/]+)\/(\d+)$/;
	const standardPattern = /^https:\/\/open\.spotify\.com\/([^\/]+)\/([^\/?]+)/;

	if (localPattern.test(link)) {
		// Local file format: https://open.spotify.com/local/artist/album/title/duration
		const matches = link.match(localPattern);
		if (!matches) {
			throw new TypeError(`${link} is not a valid Spotify local file link`);
		}

		// URL decode artist, album, and title
		const artist = decodeURIComponent(matches[1] || '');
		const album = decodeURIComponent(matches[2] || '');
		const title = decodeURIComponent(matches[3]);
		const duration = parseInt(matches[4], 10);

		if (isNaN(duration)) {
			throw new TypeError(`${link} has an invalid duration`);
		}

		return { type: "track", is_local: true, artist, album, title, duration };
	} else if (standardPattern.test(link)) {
		// Not a local file
		const matches = link.match(standardPattern);
		if (!matches || matches.length < 3) {
			throw new TypeError(`${link} is not a valid Spotify link`);
		}

		const type = matches[1];
		const id = matches[2];

		if (!base62Pattern.test(id)) {
			throw new TypeError(`${link} has an invalid ID`);
		}

		return { type, is_local: false, id };
	} else {
		throw new TypeError(`${link} is not a valid Spotify link`);
	}
}

module.exports = {
	parseSpotifyUri,
	parseSpotifyLink
}
