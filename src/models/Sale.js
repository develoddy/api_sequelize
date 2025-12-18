import { DataTypes } from 'sequelize';
import { sequelize } from '../database/database.js';

export const Sale = sequelize.define('sales', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  currency_payment: { type: DataTypes.STRING, defaultValue: 'EUR' },
  method_payment: { type: DataTypes.STRING(50), allowNull: false },
  n_transaction: { type: DataTypes.STRING(200), allowNull: false },
  total: { type: DataTypes.FLOAT, allowNull: false },
  currency_total: { type: DataTypes.STRING(50), defaultValue: 'EUR' },
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
  // Tracking fields
  trackingNumber: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  trackingUrl: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  carrier: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  shippedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  // Security: Token for public tracking access
  trackingToken: {
    type: DataTypes.STRING(32),
    allowNull: false,
    unique: true,
    comment: 'Token único para acceso público al tracking'
  },
  // Error handling
  errorMessage: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  // Sync status with Printful
  syncStatus: {
    type: DataTypes.ENUM('pending', 'failed', 'shipped', 'canceled', 'fulfilled'),
    allowNull: true,
    defaultValue: 'pending'
  },
  completedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  // Localization context
  country: {
    type: DataTypes.STRING(5),
    allowNull: true,
    defaultValue: 'es',
    comment: 'País de contexto de la compra (es, fr, it, de)'
  },
  locale: {
    type: DataTypes.STRING(5),
    allowNull: true,
    defaultValue: 'es',
    comment: 'Idioma de contexto de la compra (es, fr, it, de)'
  }
}, {
  timestamps: true,
  tableName: 'sales'
});

