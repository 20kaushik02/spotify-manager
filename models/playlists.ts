"use strict";
import {
  AllowNull,
  Column,
  DataType,
  Model,
  Table,
} from "sequelize-typescript";
@Table
class playlists extends Model<Partial<playlists>> {
  @AllowNull(false)
  @Column(DataType.STRING)
  declare playlistID: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare playlistName: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare userID: string;
}

export default playlists;
