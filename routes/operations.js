const router = require('express').Router();

const { updateUser } = require('../controllers/operations');
const { isAuthenticated } = require('../middleware/authCheck');

router.post(
	"/update",
	isAuthenticated,
	updateUser
);

module.exports = router;
