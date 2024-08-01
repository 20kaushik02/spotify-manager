const router = require('express').Router();

const { updateUser, fetchUser, createLink, removeLink, populateMissingInLink } = require('../controllers/operations');
const { validate } = require('../validators');
const { createLinkValidator, removeLinkValidator, populateMissingInLinkValidator } = require('../validators/operations');

router.put(
	"/update",
	updateUser
);

router.get(
	"/fetch",
	fetchUser
);

router.post(
	"/link",
	createLinkValidator,
	validate,
	createLink
);

router.delete(
	"/link",
	removeLinkValidator,
	validate,
	removeLink
);

router.put(
	"/populate/link",
	populateMissingInLinkValidator,
	validate,
	populateMissingInLink
);

module.exports = router;
