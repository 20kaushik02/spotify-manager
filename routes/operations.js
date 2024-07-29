const router = require('express').Router();

const { updateUser, fetchUser } = require('../controllers/operations');
const { isAuthenticated } = require('../middleware/authCheck');

router.put(
	"/update",
	isAuthenticated,
	updateUser
);

router.get(
	"/fetch",
	isAuthenticated,
	fetchUser
);

module.exports = router;
