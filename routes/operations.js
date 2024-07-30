const router = require('express').Router();

const { updateUser, fetchUser, createLink, removeLink } = require('../controllers/operations');
const { isAuthenticated } = require('../middleware/authCheck');
const { validate } = require('../validators');
const { createLinkValidator, removeLinkValidator } = require('../validators/operations');

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

router.post(
	"/link",
	isAuthenticated,
	createLinkValidator,
	validate,
	createLink
);

router.delete(
	"/link",
	isAuthenticated,
	removeLinkValidator,
	validate,
	removeLink
);

module.exports = router;
