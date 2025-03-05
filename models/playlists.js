"use strict";
import { Model } from "sequelize";
export default (sequelize, DataTypes) => {
  class playlists extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  playlists.init({
    playlistID: DataTypes.STRING,
    playlistName: DataTypes.STRING,
    userID: DataTypes.STRING
  }, {
    sequelize,
    modelName: "playlists",
  });
  return playlists;
};
