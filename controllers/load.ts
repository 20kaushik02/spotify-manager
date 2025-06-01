import type { RequestHandler } from "express";

// load db models
import Links from "../models/links.ts";
import Playlists from "../models/playlists.ts";

import { dateForFilename } from "../utils/getFormattedDate.ts";
import logger from "../utils/logger.ts";

const exportData: RequestHandler = async (req, res) => {
  try {
    if (!req.session.user)
      throw new ReferenceError("session does not have user object");
    const uID = req.session.user.id;

    const currentPlaylists = await Playlists.findAll({
      attributes: ["playlistID", "playlistName"],
      raw: true,
      where: {
        userID: uID,
      },
    });
    const currentLinks = await Links.findAll({
      attributes: ["from", "to"],
      raw: true,
      where: {
        userID: uID,
      },
    });

    res.attachment(
      "Spotify Manager - Core Backup - " + dateForFilename() + ".json"
    );
    res.send(JSON.stringify({ currentPlaylists, currentLinks }));
    logger.debug("exported data");
    return;
  } catch (error) {
    res.status(500).send({ message: "Internal Server Error" });
    logger.error("exportData", { error });
    return;
  }
};

const importData: RequestHandler = async (req, res) => {
  try {
    if (!req.session.user)
      throw new ReferenceError("session does not have user object");
    const uID = req.session.user.id;

    if (!req.file) {
      res.status(400).send({ message: "No file provided!" });
      logger.debug("no file provided");
      return;
    }
    let exportedLinks: Pick<Links, "from" | "to">[];
    let exportedPls: Pick<Playlists, "playlistID" | "playlistName">[];
    try {
      let exportedData = JSON.parse(req.file.buffer.toString());
      exportedLinks = structuredClone(exportedData["currentLinks"]);
      exportedPls = structuredClone(exportedData["currentPlaylists"]);
    } catch (error: any) {
      const message = "Could not parse data file";
      res.status(400).send({ message });
      logger.info(message, { error });
      return;
    }

    const delPlNum = await Playlists.destroy({ where: { userID: uID } });
    const delLinkNum = await Links.destroy({ where: { userID: uID } });
    logger.debug("cleaned before importing", { delPlNum, delLinkNum });

    const addedPls = await Playlists.bulkCreate(
      exportedPls.map((pl) => {
        return { ...pl, userID: uID };
      }),
      { validate: true }
    );
    if (addedPls.length !== exportedPls.length) {
      logger.error("Could not import all playlists");
    }
    const addedLinks = await Links.bulkCreate(
      exportedLinks.map((link) => {
        return { ...link, userID: uID };
      }),
      { validate: true }
    );
    if (addedLinks.length !== exportedLinks.length) {
      logger.error("Could not import all links");
    }
    const message =
      "Imported " +
      addedLinks.length +
      " links, " +
      addedPls.length +
      " playlists.";
    res
      .status(200)
      .send({ message, links: addedLinks.length, playlists: addedPls.length });
    logger.debug(message, {
      links: addedLinks.length,
      playlists: addedPls.length,
    });
    return;
  } catch (error) {
    res.status(500).send({ message: "Internal Server Error" });
    logger.error("exportData", { error });
    return;
  }
};

export { exportData, importData };
