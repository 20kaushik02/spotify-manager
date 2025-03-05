"use strict";
/** @type {import("sequelize-cli").Migration} */
export default {
  up: async function (queryInterface, Sequelize) {
    await queryInterface.createTable("playlists", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      playlistID: {
        type: Sequelize.STRING
      },
      playlistName: {
        type: Sequelize.STRING
      },
      userID: {
        type: Sequelize.STRING
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },
  down: async function (queryInterface, Sequelize) {
    await queryInterface.dropTable("playlists");
  }
};
