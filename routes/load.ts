import { Router } from "express";
const loadRouter: Router = Router();

import multer from "multer";
const upload = multer({ limits: { fileSize: 1024 * 1024 /** 1MB */ } });
import { exportData, importData } from "../controllers/load.ts";

// import { validate } from "../validators/index.ts";

loadRouter.get("/", exportData);
loadRouter.put("/", upload.single("dataFile"), importData);

export default loadRouter;
