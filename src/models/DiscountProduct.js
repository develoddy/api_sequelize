import { DataTypes } from 'sequelize';
import { sequelize } from '../database/database.js';


export const DiscountProduct = sequelize.define('discounts_product', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    discountId: { type: DataTypes.INTEGER, allowNull: false },
    productId: { type: DataTypes.INTEGER, allowNull: false }
}, {
  timestamps: true,
  tableName: 'discounts_product'
});