const accountsAPIURL = "https://accounts.spotify.com";
const baseAPIURL = "https://api.spotify.com/v1";
const sessionName = "spotify-manager";
const stateKey = "spotify_auth_state";

const requiredScopes = {
  // Playlists
  GetCollaborativePlaylists: "playlist-read-collaborative",
  GetPrivatePlaylists: "playlist-read-private",
  ModifyPrivatePlaylists: "playlist-modify-private",
  ModifyPublicPlaylists: "playlist-modify-public",
  // User
  AccessUser: "user-read-private",
};

export { accountsAPIURL, baseAPIURL, sessionName, stateKey, requiredScopes };
