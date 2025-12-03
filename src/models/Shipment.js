/**
 * ⚠️ DEPRECATED: Este modelo está obsoleto y ya no debe usarse.
 * 
 * Motivo:
 * - La tabla Shipments es redundante con los campos de tracking en Sales
 * - Printful webhooks actualizan directamente la tabla Sales:
 *   * Sales.trackingNumber
 *   * Sales.trackingUrl
 *   * Sales.carrier
 *   * Sales.shippedAt
 *   * Sales.minDeliveryDate
 *   * Sales.maxDeliveryDate
 * 
 * Flujo de datos actual:
 * 1. Printful envía webhook 'package_shipped'
 * 2. Webhook actualiza campos de tracking en Sales table
 * 3. Admin-Sales module muestra esta información
 * 4. Admin-Chat CustomerContext muestra tracking via Sales relationship
 * 
 * Reemplazo: Use los campos de tracking en el modelo Sale
 * 
 * Esta tabla se mantiene por compatibilidad pero NO debe usarse en nuevo código.
 * 
 * @deprecated Use Sale model tracking fields instead. This table is no longer maintained.
 */

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
