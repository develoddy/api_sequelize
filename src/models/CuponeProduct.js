import { DataTypes } from 'sequelize';
import { sequelize } from '../database/database.js';


export const CuponeProduct = sequelize.define('cupones_product', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    cuponeId: { type: DataTypes.INTEGER, allowNull: false },
    productId: { type: DataTypes.INTEGER, allowNull: false }
}, {
  timestamps: true,
  tableName: 'cupones_product'
});