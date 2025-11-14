import { DataTypes } from 'sequelize';
import { sequelize } from '../database/database.js';

export const Sale = sequelize.define('sales', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  currency_payment: { type: DataTypes.STRING, defaultValue: 'EUR' },
  method_payment: { type: DataTypes.STRING(50), allowNull: false },
  n_transaction: { type: DataTypes.STRING(200), allowNull: false },
  total: { type: DataTypes.FLOAT, allowNull: false },
  curreny_total: { type: DataTypes.STRING(50), defaultValue: 'EUR' },
  price_dolar: { type: DataTypes.FLOAT, defaultValue: 0 },
  minDeliveryDate: { type: DataTypes.DATEONLY, allowNull: true },
  maxDeliveryDate: { type: DataTypes.DATEONLY, allowNull: true },
  // Stripe session identifier
  stripeSessionId: { type: DataTypes.STRING, allowNull: true },
  // Printful integration fields
  printfulOrderId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  printfulStatus: {
    type: DataTypes.STRING,
    allowNull: true
  },
  printfulUpdatedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
}, {
  timestamps: true,
  tableName: 'sales'
});

