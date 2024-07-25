const router = require('express').Router();

const { getUserPlaylists, getPlaylistDetails } = require('../controllers/playlists');
const { isAuthenticated } = require('../middleware/authCheck');
const { getPlaylistDetailsValidator } = require('../validators/playlists');
const validator = require("../validators");

router.get(
	"/user",
	isAuthenticated,
	validator.validate,
	getUserPlaylists
);

router.get(
	"/details",
	isAuthenticated,
	getPlaylistDetailsValidator,
	validator.validate,
	getPlaylistDetails
);

module.exports = router;
