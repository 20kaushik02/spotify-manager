import { Router } from "express";
const playlistRouter: Router = Router();

import { fetchUserPlaylists } from "../controllers/playlists.ts";

// import { validate } from "../validators/index.ts";

playlistRouter.get("/me", fetchUserPlaylists);

export default playlistRouter;
