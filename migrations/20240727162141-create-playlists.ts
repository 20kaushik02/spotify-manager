"use strict";
import type { Migration } from "sequelize-cli";
export default {
  up: async function (queryInterface, Sequelize) {
    await queryInterface.createTable("playlists", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      playlistID: {
        type: Sequelize.STRING,
      },
      playlistName: {
        type: Sequelize.STRING,
      },
      userID: {
        type: Sequelize.STRING,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });
  },
  down: async function (queryInterface, _Sequelize) {
    await queryInterface.dropTable("playlists");
  },
} as Migration;
