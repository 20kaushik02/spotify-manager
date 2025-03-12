import { Router } from "express";
const router: Router = Router();

import { fetchUserPlaylists } from "../controllers/playlists.ts";

// import { validate } from "../validators/index.ts";

router.get("/me", fetchUserPlaylists);

export default router;
