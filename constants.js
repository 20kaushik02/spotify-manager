const accountsAPIURL = 'https://accounts.spotify.com';
const baseAPIURL = 'https://api.spotify.com/v1';

const stateKey = 'spotify_auth_state';

const scopes = {
	ImageUpload: 'ugc-image-upload',
	ControlPlayback: 'user-modify-playback-state',
	ViewPlaybackState: 'user-read-playback-state',
	ViewCurrentlyPlaying: 'user-read-currently-playing',
	ModifyFollow: 'user-follow-modify',
	ViewFollow: 'user-follow-read',
	ViewRecentlyPlayed: 'user-read-recently-played',
	ViewPlaybackPosition: 'user-read-playback-position',
	ViewTop: 'user-top-read',
	ViewPrivatePlaylists: 'playlist-read-private',
	IncludeCollaborative: 'playlist-read-collaborative',
	ModifyPublicPlaylists: 'playlist-modify-public',
	ModifyPrivatePlaylists: 'playlist-modify-private',
	ControlRemotePlayback: 'app-remote-control',
	ModifyLibrary: 'user-library-modify',
	ViewLibrary: 'user-library-read'
};

module.exports = {
	accountsAPIURL,
	baseAPIURL,
	stateKey,
	scopes
}