"use strict";
import {
  AllowNull,
  Column,
  DataType,
  Model,
  Table,
} from "sequelize-typescript";
@Table
class links extends Model<Partial<links>> {
  @AllowNull(false)
  @Column(DataType.STRING)
  declare userID: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare from: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare to: string;
}
export default links;
