import { sequelize } from '../database/database.js';
import { DataTypes, Op } from 'sequelize';

/**
 * Model: Tenant
 * Representa un cliente que usa uno de los micro-SaaS
 * Cada tenant tiene acceso aislado a su módulo específico
 */

export const Tenant = sequelize.define('Tenant', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  
  // Información básica
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: true
    }
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      isEmail: true,
      notEmpty: true
    }
  },
  
  // Autenticación
  password: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: 'Contraseña hasheada con bcrypt'
  },
  
  // Relación con módulo SaaS
  module_key: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: 'Key del módulo SaaS al que pertenece este tenant'
  },
  
  // Plan y estado
  plan: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'trial',
    comment: 'Plan actual: trial, starter, pro, business, etc.'
  },
  status: {
    type: DataTypes.ENUM('trial', 'active', 'cancelled', 'suspended', 'expired'),
    defaultValue: 'trial',
    allowNull: false
  },
  
  // Trial
  trial_ends_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Fecha en que expira el trial'
  },
  trial_extended: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Si el trial fue extendido manualmente'
  },
  
  // Billing (Stripe)
  stripe_customer_id: {
    type: DataTypes.STRING(100),
    allowNull: true,
    unique: true,
    comment: 'ID del customer en Stripe'
  },
  stripe_subscription_id: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'ID de la subscripción activa en Stripe'
  },
  stripe_price_id: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'ID del price en Stripe'
  },
  
  // Fechas importantes
  subscribed_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Fecha en que se convirtió de trial a subscripción pagada'
  },
  cancelled_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  subscription_ends_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Fecha de fin de acceso (para cancelaciones)'
  },
  
  // Configuración y metadata
  settings: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: 'Configuraciones específicas del tenant'
  },
  metadata: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: 'Metadata adicional (utm, referrer, etc.)'
  },
  
  // Notas admin
  admin_notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Notas internas para el admin'
  }
}, {
  tableName: 'tenants',
  timestamps: true,
  underscored: true,
  indexes: [
    { unique: true, fields: ['email', 'module_key'], name: 'unique_email_module' },
    { fields: ['module_key'] },
    { fields: ['status'] },
    { fields: ['plan'] },
    { unique: true, fields: ['stripe_customer_id'], where: { stripe_customer_id: { [Op.ne]: null } } }
  ]
});

/**
 * Instance Methods
 */

// Verificar si está en trial
Tenant.prototype.isOnTrial = function() {
  return this.status === 'trial' && this.trial_ends_at && new Date() < new Date(this.trial_ends_at);
};

// Verificar si el trial expiró
Tenant.prototype.hasTrialExpired = function() {
  return this.status === 'trial' && this.trial_ends_at && new Date() >= new Date(this.trial_ends_at);
};

// Verificar si tiene acceso activo
Tenant.prototype.hasAccess = function() {
  return ['trial', 'active'].includes(this.status) && 
         (this.status === 'active' || this.isOnTrial());
};

// Días restantes de trial
Tenant.prototype.getDaysRemainingInTrial = function() {
  if (!this.trial_ends_at) return 0;
  const now = new Date();
  const end = new Date(this.trial_ends_at);
  const diffTime = end - now;
  return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
};

// Convertir a subscripción pagada
Tenant.prototype.convertToSubscription = async function(plan, stripeSubscriptionId, stripePriceId) {
  this.status = 'active';
  this.plan = plan;
  this.stripe_subscription_id = stripeSubscriptionId;
  this.stripe_price_id = stripePriceId;
  this.subscribed_at = new Date();
  await this.save();
  return this;
};

// Cancelar subscripción
Tenant.prototype.cancelSubscription = async function(endDate = null) {
  this.status = 'cancelled';
  this.cancelled_at = new Date();
  this.subscription_ends_at = endDate || new Date();
  await this.save();
  return this;
};

/**
 * Associations
 */
Tenant.associate = (models) => {
  Tenant.belongsTo(models.Module, {
    foreignKey: 'module_key',
    targetKey: 'key',
    as: 'module'
  });
};

export default Tenant;
