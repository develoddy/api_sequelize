import { DataTypes } from 'sequelize';
import { sequelize } from '../database/database.js';

export const ProductVariants = sequelize.define('productVariants', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  variant_id: { type: DataTypes.INTEGER, allowNull: false },
  product_id: { type: DataTypes.INTEGER, allowNull: false },
  image: { type: DataTypes.STRING, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false }
}, {
  timestamps: true,
  tableName: 'productVariants'
});
