import { DataTypes } from 'sequelize';
import { sequelize } from '../database/database.js';
import { User } from './User.js'; 

export const Sale = sequelize.define('sales', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  currency_payment: { type: DataTypes.STRING, defaultValue: 'EUR' },
  method_payment: { type: DataTypes.STRING(50), allowNull: false },
  n_transaction: { type: DataTypes.STRING(200), allowNull: false },
  total: { type: DataTypes.FLOAT, allowNull: false },
  curreny_total: { type: DataTypes.STRING(50), defaultValue: 'EUR' },
  price_dolar: { type: DataTypes.FLOAT, defaultValue: 0 }
}, {
  timestamps: true,
  tableName: 'sales'
});

// Define la asociación con el modelo de Usuario
Sale.belongsTo(User, { foreignKey: 'userId' });
