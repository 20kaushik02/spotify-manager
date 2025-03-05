import { Router } from "express";
const router = Router();

import { fetchUserPlaylists, fetchPlaylistDetails } from "../controllers/playlists.js";
import { getPlaylistDetailsValidator } from "../validators/playlists.js";

import { validate } from "../validators/index.js";

router.get(
  "/me",
  fetchUserPlaylists
);

router.get(
  "/details",
  getPlaylistDetailsValidator,
  validate,
  fetchPlaylistDetails
);

export default router;
