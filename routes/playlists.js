const router = require('express').Router();

const { getUserPlaylists } = require('../controllers/playlists');
const { isAuthenticated } = require('../middleware/authCheck');
const validator = require("../validators");

router.get(
	"/user",
	isAuthenticated,
	validator.validate,
	getUserPlaylists
);

module.exports = router;
