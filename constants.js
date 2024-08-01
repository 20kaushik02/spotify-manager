const accountsAPIURL = 'https://accounts.spotify.com';
const baseAPIURL = 'https://api.spotify.com/v1';
const sessionName = 'spotify-manager';
const stateKey = 'spotify_auth_state';

const scopes = {
	// ImageUpload: 'ugc-image-upload',
	AccessPrivatePlaylists: 'playlist-read-private',
	AccessCollaborativePlaylists: 'playlist-read-collaborative',
	ModifyPublicPlaylists: 'playlist-modify-public',
	ModifyPrivatePlaylists: 'playlist-modify-private',
	// ModifyFollow: 'user-follow-modify',
	AccessFollow: 'user-follow-read',
	ModifyLibrary: 'user-library-modify',
	AccessLibrary: 'user-library-read',
	AccessUser: 'user-read-private',
};

module.exports = {
	accountsAPIURL,
	baseAPIURL,
	sessionName,
	stateKey,
	scopes
}