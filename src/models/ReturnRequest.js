import { DataTypes } from 'sequelize';
import { sequelize } from '../database/database.js';
import { Sale } from './Sale.js';
import { User } from './User.js';

export const ReturnRequest = sequelize.define('return_requests', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  saleId: { type: DataTypes.INTEGER, allowNull: false },
  userId: { type: DataTypes.INTEGER, allowNull: true },
  guestId: { type: DataTypes.STRING, allowNull: true },
  reason: { type: DataTypes.TEXT, allowNull: true },
  status: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'pending' // pending, reviewing, approved, denied, refunded
  },
  adminNotes: { type: DataTypes.TEXT, allowNull: true },
  resolution: { type: DataTypes.TEXT, allowNull: true },
  refundAmount: { type: DataTypes.DOUBLE, allowNull: true },
  createdBy: { type: DataTypes.STRING, allowNull: true } // admin id o email
}, {
  timestamps: true,
  tableName: 'return_requests'
});


