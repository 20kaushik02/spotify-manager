const router = require('express').Router();

const { login, callback, refresh } = require('../controllers/auth');
const validator = require("../validators");

router.get(
	"/login",
	validator.validate,
	login
);

router.get(
	"/callback",
	validator.validate,
	callback
);

router.get(
	"/refresh",
	validator.validate,
	refresh
)

module.exports = router;
