const router = require('express').Router();

const { getUserPlaylists, getPlaylistDetails } = require('../controllers/playlists');
const { getPlaylistDetailsValidator } = require('../validators/playlists');
const { validate } = require("../validators");

router.get(
	"/me",
	getUserPlaylists
);

router.get(
	"/details",
	getPlaylistDetailsValidator,
	validate,
	getPlaylistDetails
);

module.exports = router;
