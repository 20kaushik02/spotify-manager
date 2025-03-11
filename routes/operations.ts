import { Router } from "express";
const opRouter: Router = Router();

import {
  updateUser,
  fetchUser,
  createLink,
  removeLink,
  populateSingleLink,
  pruneSingleLink,
} from "../controllers/operations.ts";
import {
  createLinkValidator,
  removeLinkValidator,
  populateSingleLinkValidator,
  pruneSingleLinkValidator,
} from "../validators/operations.ts";

import { validate } from "../validators/index.ts";

opRouter.put("/update", updateUser);

opRouter.get("/fetch", fetchUser);

opRouter.post("/link", createLinkValidator, validate, createLink);

opRouter.delete("/link", removeLinkValidator, validate, removeLink);

opRouter.put(
  "/populate/link",
  populateSingleLinkValidator,
  validate,
  populateSingleLink
);

opRouter.put(
  "/prune/link",
  pruneSingleLinkValidator,
  validate,
  pruneSingleLink
);

export default opRouter;
