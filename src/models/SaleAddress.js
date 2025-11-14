import { DataTypes } from 'sequelize';
import { sequelize } from '../database/database.js';
import { Sale } from './Sale.js'; 

export const SaleAddress = sequelize.define('sale_addresses', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  name: { type: DataTypes.STRING(250), allowNull: false },
  surname: { type: DataTypes.STRING(250), allowNull: false },
  pais: { type: DataTypes.STRING(250), allowNull: false },
  address: { type: DataTypes.STRING(250), allowNull: false },
  referencia: { type: DataTypes.STRING(250), allowNull: true },
  ciudad: { type: DataTypes.STRING(250), allowNull: false },
  region: { type: DataTypes.STRING(250), allowNull: false },
  telefono: { type: DataTypes.STRING(250), allowNull: false },
  email: { type: DataTypes.STRING(250), allowNull: false },
  nota: { type: DataTypes.STRING, allowNull: true },
  zipcode: { type: DataTypes.STRING(250), allowNull: false },
}, {
  timestamps: true,
  tableName: 'sale_addresses'
});

// Define la asociación con el modelo de Venta
SaleAddress.belongsTo(Sale, { foreignKey: 'saleId' });
