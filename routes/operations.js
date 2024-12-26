const router = require("express").Router();

const { updateUser, fetchUser, createLink, removeLink, populateSingleLink, pruneSingleLink } = require("../controllers/operations");
const { validate } = require("../validators");
const { createLinkValidator, removeLinkValidator, populateSingleLinkValidator, pruneSingleLinkValidator } = require("../validators/operations");

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
	populateSingleLinkValidator,
	validate,
	populateSingleLink
);

router.put(
	"/prune/link",
	pruneSingleLinkValidator,
	validate,
	pruneSingleLink
);

module.exports = router;
