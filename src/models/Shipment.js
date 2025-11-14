import { DataTypes } from 'sequelize';
import { sequelize } from '../database/database.js';
import { Sale } from './Sale.js';

export const Shipment = sequelize.define('shipments', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  saleId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'sales',
      key: 'id',
    },
  },
  printfulShipmentId: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  carrier: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  service: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  trackingNumber: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  trackingUrl: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'pending', // pending | shipped | delivered | returned | canceled
  },
  shippedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  deliveredAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  returnedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  timestamps: true,
  tableName: 'shipments',
});

// 🔗 Asociación con Sale
Sale.hasMany(Shipment, { foreignKey: 'saleId', as: 'shipments' });
Shipment.belongsTo(Sale, { foreignKey: 'saleId', as: 'sale' });
