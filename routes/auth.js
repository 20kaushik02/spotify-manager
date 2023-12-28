const router = require('express').Router();

const { login, callback, refresh, logout } = require('../controllers/auth');
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
	validator.validate,
	refresh
)

router.get(
	"/logout",
	logout,
)
module.exports = router;
