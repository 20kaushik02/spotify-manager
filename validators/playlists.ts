import { query } from "express-validator";
import type { RequestHandler } from "express";

const getPlaylistDetailsValidator: RequestHandler = async (req, _res, next) => {
  await query("playlist_link")
    .notEmpty()
    .withMessage("playlist_link not defined in query")
    .isURL()
    .withMessage("playlist_link must be a valid link")
    .run(req);
  next();
};

export { getPlaylistDetailsValidator };
