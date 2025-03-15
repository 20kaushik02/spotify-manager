import { Router } from "express";
const opRouter: Router = Router();

import {
  updateUser,
  fetchUser,
  createLink,
  removeLink,
  populateSingleLink,
  pruneSingleLink,
  populateChain,
  pruneChain,
} from "../controllers/operations.ts";
import { linkValidator, nodeValidator } from "../validators/operations.ts";

import { validate } from "../validators/index.ts";

opRouter.put("/update", updateUser);

opRouter.get("/fetch", fetchUser);

opRouter.post("/link", linkValidator, validate, createLink);

opRouter.delete("/link", linkValidator, validate, removeLink);

opRouter.put("/populate/link", linkValidator, validate, populateSingleLink);
opRouter.put("/populate/chain", nodeValidator, validate, populateChain);

opRouter.put("/prune/link", linkValidator, validate, pruneSingleLink);
opRouter.put("/prune/chain", nodeValidator, validate, pruneChain);

export default opRouter;
