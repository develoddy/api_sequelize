import { DataTypes } from 'sequelize';
import { sequelize } from '../database/database.js';

/**
 * Modelo StripeWebhookLog
 * 
 * Registra todos los webhooks recibidos de Stripe para:
 * - Auditoría de eventos
 * - Debugging de subscripciones
 * - Detección de errores
 * - Reintento de webhooks fallidos
 */
export const StripeWebhookLog = sequelize.define('StripeWebhookLog', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  
  // Información del evento de Stripe
  event_id: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
    comment: 'ID único del evento de Stripe (evt_xxx)'
  },
  
  event_type: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: 'Tipo de evento (checkout.session.completed, invoice.paid, etc.)'
  },
  
  // Datos completos del evento
  payload: {
    type: DataTypes.TEXT('long'),
    allowNull: true,
    get() {
      const rawValue = this.getDataValue('payload');
      return rawValue ? JSON.parse(rawValue) : null;
    },
    set(value) {
      this.setDataValue('payload', JSON.stringify(value));
    },
    comment: 'JSON completo del evento de Stripe'
  },
  
  // Metadata relevante extraída
  tenant_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'ID del tenant relacionado (si aplica)'
  },
  
  subscription_id: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'ID de subscripción de Stripe (sub_xxx)'
  },
  
  customer_id: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'ID de customer de Stripe (cus_xxx)'
  },
  
  // Estado del procesamiento
  status: {
    type: DataTypes.ENUM('pending', 'processing', 'success', 'failed'),
    defaultValue: 'pending',
    allowNull: false,
    comment: 'Estado del procesamiento del webhook'
  },
  
  // Resultado del procesamiento
  response_message: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Mensaje de respuesta o error'
  },
  
  retry_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Número de reintentos'
  },
  
  // Timestamps
  received_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    comment: 'Cuándo se recibió el webhook'
  },
  
  processed_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Cuándo se procesó exitosamente'
  },
  
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'stripe_webhook_logs',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['event_id'], unique: true },
    { fields: ['event_type'] },
    { fields: ['tenant_id'] },
    { fields: ['subscription_id'] },
    { fields: ['status'] },
    { fields: ['received_at'] }
  ]
});

/**
 * Métodos de instancia
 */

// Marcar como procesado exitosamente
StripeWebhookLog.prototype.markAsSuccess = async function(message = 'Processed successfully') {
  this.status = 'success';
  this.response_message = message;
  this.processed_at = new Date();
  await this.save();
  return this;
};

// Marcar como fallido
StripeWebhookLog.prototype.markAsFailed = async function(errorMessage) {
  this.status = 'failed';
  this.response_message = errorMessage;
  this.retry_count += 1;
  await this.save();
  return this;
};

// Marcar como en procesamiento
StripeWebhookLog.prototype.markAsProcessing = async function() {
  this.status = 'processing';
  await this.save();
  return this;
};

/**
 * Métodos estáticos
 */

// Crear log desde evento de Stripe
StripeWebhookLog.createFromEvent = async function(event, additionalData = {}) {
  const eventData = event.data.object;
  
  // Extraer metadata relevante según tipo de evento
  let tenantId = null;
  let subscriptionId = null;
  let customerId = null;
  
  if (event.type === 'checkout.session.completed') {
    tenantId = eventData.metadata?.tenantId;
    subscriptionId = eventData.subscription;
    customerId = eventData.customer;
  } else if (event.type === 'invoice.paid' || event.type === 'invoice.payment_failed') {
    subscriptionId = eventData.subscription;
    customerId = eventData.customer;
  } else if (event.type.startsWith('customer.subscription.')) {
    tenantId = eventData.metadata?.tenantId;
    subscriptionId = eventData.id;
    customerId = eventData.customer;
  }
  
  return await this.create({
    event_id: event.id,
    event_type: event.type,
    payload: event,
    tenant_id: tenantId ? Number(tenantId) : null,
    subscription_id: subscriptionId,
    customer_id: customerId,
    status: 'pending',
    received_at: new Date(),
    ...additionalData
  });
};

// Obtener webhooks fallidos para reintentar
StripeWebhookLog.getFailedWebhooks = async function(limit = 50) {
  return await this.findAll({
    where: { 
      status: 'failed',
      retry_count: { [sequelize.Sequelize.Op.lt]: 3 } // Máximo 3 reintentos
    },
    order: [['received_at', 'ASC']],
    limit
  });
};

// Estadísticas de webhooks
StripeWebhookLog.getStats = async function(since = null) {
  const whereClause = since ? { 
    received_at: { [sequelize.Sequelize.Op.gte]: since }
  } : {};
  
  const [total, success, failed, pending] = await Promise.all([
    this.count({ where: whereClause }),
    this.count({ where: { ...whereClause, status: 'success' } }),
    this.count({ where: { ...whereClause, status: 'failed' } }),
    this.count({ where: { ...whereClause, status: 'pending' } })
  ]);
  
  return {
    total,
    success,
    failed,
    pending,
    success_rate: total > 0 ? ((success / total) * 100).toFixed(2) : 0
  };
};

export default StripeWebhookLog;
