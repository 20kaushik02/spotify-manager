import { Router } from "express";
const router = Router();

import { updateUser, fetchUser, createLink, removeLink, populateSingleLink, pruneSingleLink } from "../controllers/operations.js";
import { createLinkValidator, removeLinkValidator, populateSingleLinkValidator, pruneSingleLinkValidator } from "../validators/operations.js";

import { validate } from "../validators/index.js";

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

export default router;
