const router = require('express').Router();

const { login, callback, refresh, logout } = require('../controllers/auth');
const { isAuthenticated } = require('../middleware/authCheck');
const validator = require("../validators");

router.get(
	"/login",
	login
);

router.get(
	"/callback",
	callback
);

router.get(
	"/refresh",
	isAuthenticated,
	refresh
)

router.get(
	"/logout",
	logout,
)
module.exports = router;
