// models/Notification.js
import { DataTypes } from 'sequelize';
import { sequelize } from '../database/database.js';
import { User } from './User.js'; 
import { Sale } from './Sale.js';
import { Shipment } from './Shipment.js';

export const Notification = sequelize.define('notifications', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  color: {
    type: DataTypes.STRING,
    defaultValue: 'primary' // success, danger, warning...
  },
  type: {
    type: DataTypes.STRING, // package_shipped, new_order, etc
    allowNull: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users', // nombre de la tabla en la DB
      key: 'id'
    }
  },
  isRead: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  meta: {
    type: DataTypes.JSON, // JSON válido en MySQL/MariaDB
    allowNull: true
  }
}, {
  timestamps: true,
  tableName: 'notifications',
});

// 🔗 Asociaciones opcionales
User.hasMany(Notification, { foreignKey: 'userId', as: 'notifications' });
Notification.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Sale.hasMany(Notification, { foreignKey: 'saleId', as: 'notifications' });
Notification.belongsTo(Sale, { foreignKey: 'saleId', as: 'sale' });

Shipment.hasMany(Notification, { foreignKey: 'shipmentId', as: 'notifications' });
Notification.belongsTo(Shipment, { foreignKey: 'shipmentId', as: 'shipment' });