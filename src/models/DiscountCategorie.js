
import { DataTypes } from 'sequelize';
import { sequelize } from '../database/database.js';


export const DiscountCategorie = sequelize.define('discounts_categorie', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    discountId: { type: DataTypes.INTEGER, allowNull: false },
    categoryId: { type: DataTypes.INTEGER, allowNull: false }
}, {
  timestamps: true,
  tableName: 'discounts_categorie'
});