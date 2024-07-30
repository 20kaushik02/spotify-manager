const router = require('express').Router();

const { getUserPlaylists, getPlaylistDetails } = require('../controllers/playlists');
const { isAuthenticated } = require('../middleware/authCheck');
const { getPlaylistDetailsValidator } = require('../validators/playlists');
const { validate } = require("../validators");

router.get(
	"/me",
	isAuthenticated,
	getUserPlaylists
);

router.get(
	"/details",
	isAuthenticated,
	getPlaylistDetailsValidator,
	validate,
	getPlaylistDetails
);

module.exports = router;
