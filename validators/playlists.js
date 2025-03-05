import { body, header, param, query } from "express-validator";
import * as typedefs from "../typedefs.js";

/**
 * @param {typedefs.Req} req
 * @param {typedefs.Res} res
 * @param {typedefs.Next} next
 */
export const getPlaylistDetailsValidator = async (req, res, next) => {
  await query("playlist_link")
    .notEmpty()
    .withMessage("playlist_link not defined in query")
    .isURL()
    .withMessage("playlist_link must be a valid link")
    .run(req);
  next();
}
