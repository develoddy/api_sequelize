import { DataTypes } from "sequelize";
import { sequelize } from "../database/database.js";

export const User = sequelize.define( 'users', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true},
    rol: { type: DataTypes.STRING(30), allowNull: false },
    name: { type: DataTypes.STRING(250), allowNull: false },
    surname: { type: DataTypes.STRING(250), allowNull: true },
    email: { type: DataTypes.STRING(250), allowNull: false, unique: true },
    password: { type: DataTypes.STRING(250), allowNull: false },
    avatar: { type: DataTypes.STRING(250), allowNull: true },
    state: { type: DataTypes.INTEGER, defaultValue: 1 },
    phone: { type: DataTypes.STRING(20), allowNull: true },
    birthday: { type: DataTypes.STRING(20), allowNull: true },
    zipcode: { type: DataTypes.STRING(20), allowNull: true },
}, {
    timestamps: true,
    tableName: 'users' // Opcional: Define el nombre de la tabla en la base de datos
});
