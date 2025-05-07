import { DataTypes } from "sequelize";
import { sequelize } from "../database/database.js";

export const Guest = sequelize.define( 'guests', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true},
    session_id: { type: DataTypes.STRING(100), allowNull: false, unique: true }, // Para identificar al invitado por sesión (Puede ser generado en el frontend con un UUID o token de sesión.)
    name: { type: DataTypes.STRING(250), allowNull: true },  // Puede dejar su nombre, opcional
    email: { type: DataTypes.STRING(250), allowNull: true, unique: true }, // Si introduce email
    phone: { type: DataTypes.STRING(20), allowNull: true },  // Puede añadir su teléfono
    zipcode: { type: DataTypes.STRING(20), allowNull: true }, // Puede añadir su código postal
    state: { type: DataTypes.INTEGER, defaultValue: 1 },  // 1: Activo, 0: Inactivo
}, {
    timestamps: true,
    tableName: 'guests'
});
