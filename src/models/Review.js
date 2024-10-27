import { DataTypes } from 'sequelize';
import { sequelize } from '../database/database.js';
import { Product } from './Product.js'; 
import { SaleDetail } from './SaleDetail.js'; 
import { User } from './User.js'; 

export const Review = sequelize.define('reviews', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  cantidad: { type: DataTypes.INTEGER, allowNull: false },
  title: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: false },
}, {
  timestamps: true,
  tableName: 'reviews'
});

// Define las asociaciones con los modelos de Producto, Detalle de Venta y Usuario
Review.belongsTo(Product, { foreignKey: 'productId' });
Review.belongsTo(SaleDetail, { foreignKey: 'saleDetailId' });
Review.belongsTo(User, { foreignKey: 'userId' });

