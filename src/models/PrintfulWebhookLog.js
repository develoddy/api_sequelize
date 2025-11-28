import { DataTypes } from 'sequelize';
import { sequelize } from '../database/database.js';

export const PrintfulWebhookLog = sequelize.define('printful_webhook_logs', {
  id: { 
    type: DataTypes.INTEGER, 
    autoIncrement: true, 
    primaryKey: true 
  },
  event_type: { 
    type: DataTypes.STRING(100), 
    allowNull: false,
    comment: 'Tipo de evento: package_shipped, order_failed, etc.'
  },
  order_id: { 
    type: DataTypes.STRING(50), 
    allowNull: true,
    comment: 'ID de la orden en Printful'
  },
  event_data: { 
    type: DataTypes.JSON, 
    allowNull: false,
    comment: 'Datos completos del webhook'
  },
  processed: { 
    type: DataTypes.BOOLEAN, 
    defaultValue: false,
    comment: 'Si el evento fue procesado correctamente'
  },
  processing_error: { 
    type: DataTypes.TEXT, 
    allowNull: true,
    comment: 'Error si hubo problema al procesar'
  },
  received_at: { 
    type: DataTypes.DATE, 
    defaultValue: DataTypes.NOW,
    comment: 'Timestamp de recepción'
  }
}, {
  timestamps: true,
  tableName: 'printful_webhook_logs',
  indexes: [
    { fields: ['event_type'] },
    { fields: ['order_id'] },
    { fields: ['received_at'] },
    { fields: ['processed'] }
  ]
});
