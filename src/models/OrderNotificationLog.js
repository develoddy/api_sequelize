import { DataTypes } from 'sequelize';
import { sequelize } from '../database/database.js';

export const OrderNotificationLog = sequelize.define(
  'OrderNotificationLog',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    saleId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    eventType: {
      type: DataTypes.ENUM(
        'order_shipped',
        'order_delivered'
      ),
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM(
        'pending',
        'sending',
        'sent',
        'failed',
        'uncertain'
      ),
      allowNull: false,
      defaultValue: 'pending'
    },
    attempts: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    smtpMessageId: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    sentAt: {
      type: DataTypes.DATE,
      allowNull: true
    }
  },
  {
    tableName: 'order_notification_logs',
    timestamps: true,
    indexes: [
      {
        name: 'uq_order_notification_event',
        unique: true,
        fields: ['saleId', 'eventType']
      }
    ]
  }
);
