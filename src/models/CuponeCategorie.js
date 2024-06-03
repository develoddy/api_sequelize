import { DataTypes } from 'sequelize';
import { sequelize } from '../database/database.js';


export const CuponeCategorie = sequelize.define('cupones_categorie', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    cuponeId: { type: DataTypes.INTEGER, allowNull: false },
    categoryId: { type: DataTypes.INTEGER, allowNull: false }
}, {
  timestamps: true,
  tableName: 'cupones_categorie'
});