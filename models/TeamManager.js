const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const TeamManager = sequelize.define(
  "TeamManager",
  {
    team_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      references: {
        model: "teams",
        key: "id",
      },
    },
    manager_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      references: {
        model: "users",
        key: "id",
      },
    },
  },
  {
    tableName: "team_managers",
    timestamps: false,
    underscored: true,
  },
);

module.exports = TeamManager;
