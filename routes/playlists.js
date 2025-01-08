const router = require("express").Router();

const { fetchUserPlaylists, fetchPlaylistDetails } = require("../controllers/playlists");
const { getPlaylistDetailsValidator } = require("../validators/playlists");
const { validate } = require("../validators");

router.get(
  "/me",
  fetchUserPlaylists
);

router.get(
  "/details",
  getPlaylistDetailsValidator,
  validate,
  fetchPlaylistDetails
);

module.exports = router;
