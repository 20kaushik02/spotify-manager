import { Router } from "express";
const authRouter: Router = Router();

import { login, callback, refresh, logout } from "../controllers/auth.ts";
import { isAuthenticated } from "../middleware/authCheck.ts";
// import { validate } from "../validators/index.ts";

authRouter.get("/login", login);

authRouter.get("/callback", callback);

authRouter.get("/refresh", isAuthenticated, refresh);

authRouter.get("/logout", logout);

export default authRouter;
