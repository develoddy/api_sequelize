import { DataTypes } from 'sequelize';
import { sequelize } from '../database/database.js';

export const Galeria = sequelize.define('galerias', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    imagen: { type: DataTypes.STRING(250), allowNull: false },
    color: { type: DataTypes.STRING(100), allowNull: false },
}, {
    timestamps: true,
    tableName: 'galerias'
});
