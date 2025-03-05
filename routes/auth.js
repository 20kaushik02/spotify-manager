import { Router } from "express";
const router = Router();

import { login, callback, refresh, logout } from "../controllers/auth.js";
import { isAuthenticated } from "../middleware/authCheck.js";
import { validate } from "../validators/index.js";

router.get(
  "/login",
  login
);

router.get(
  "/callback",
  callback
);

router.get(
  "/refresh",
  isAuthenticated,
  refresh
);

router.get(
  "/logout",
  logout
);

export default router;
