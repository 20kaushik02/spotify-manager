const router = require('express').Router();

const { getUserPlaylists, getUserPlaylist } = require('../controllers/playlists');
const { isAuthenticated } = require('../middleware/authCheck');
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
	validator.validate,
	getUserPlaylist
);

module.exports = router;
