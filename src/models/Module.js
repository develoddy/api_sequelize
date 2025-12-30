import { sequelize } from '../database/database.js';
import { DataTypes } from 'sequelize';

/**
 * Model: Module
 * Sistema multi-módulo para validar ideas rápidamente (Levels-style)
 * 
 * Cada módulo representa una idea/producto que se puede activar/desactivar
 * Validación: X ventas en Y días o se archiva
 */

export const Module = sequelize.define('Module', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  key: {
    type: DataTypes.STRING(50),
    unique: true,
    allowNull: false,
    validate: {
      notEmpty: true,
      is: /^[a-z0-9-]+$/i // Solo letras, números y guiones
    }
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: true
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  type: {
    type: DataTypes.ENUM('physical', 'digital', 'service', 'integration'),
    defaultValue: 'physical',
    allowNull: false
  },
  
  // Estado y validación
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('draft', 'testing', 'live', 'archived'),
    defaultValue: 'draft',
    allowNull: false
  },
  
  // Métricas de validación Levels-style
  validation_days: {
    type: DataTypes.INTEGER,
    defaultValue: 14,
    allowNull: false,
    validate: {
      min: 1,
      max: 90
    }
  },
  validation_target_sales: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    allowNull: false,
    validate: {
      min: 1
    }
  },
  launched_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  validated_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  archived_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  
  // Configuración
  config: {
    type: DataTypes.JSON,
    defaultValue: {},
    allowNull: true
  },
  icon: {
    type: DataTypes.STRING(50),
    defaultValue: 'fa-cube',
    allowNull: false
  },
  color: {
    type: DataTypes.STRING(20),
    defaultValue: 'primary',
    allowNull: false,
    validate: {
      isIn: [['primary', 'success', 'info', 'warning', 'danger', 'secondary']]
    }
  },
  
  // Pricing
  base_price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    validate: {
      min: 0
    }
  },
  currency: {
    type: DataTypes.STRING(3),
    defaultValue: 'EUR',
    allowNull: false,
    validate: {
      isIn: [['EUR', 'USD', 'GBP']]
    }
  },
  
  // Tracking automático
  total_sales: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false,
    validate: {
      min: 0
    }
  },
  total_revenue: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00,
    allowNull: false,
    validate: {
      min: 0
    }
  },
  total_orders: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false,
    validate: {
      min: 0
    }
  },
  last_sale_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'modules',
  timestamps: true,
  underscored: true,
  indexes: [
    { unique: true, fields: ['key'] },
    { fields: ['is_active'] },
    { fields: ['status'] },
    { fields: ['type'] }
  ]
});

/**
 * Instance Methods
 */

// Calcular días desde lanzamiento
Module.prototype.getDaysSinceLaunch = function() {
  if (!this.launched_at) return null;
  const now = new Date();
  const launch = new Date(this.launched_at);
  const diffTime = Math.abs(now - launch);
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
};

// Calcular días restantes para validación
Module.prototype.getDaysRemainingForValidation = function() {
  const daysSinceLaunch = this.getDaysSinceLaunch();
  if (daysSinceLaunch === null) return null;
  return Math.max(0, this.validation_days - daysSinceLaunch);
};

// Verificar si está validado
Module.prototype.isValidated = function() {
  return this.total_sales >= this.validation_target_sales;
};

// Verificar si expiró el periodo de validación sin éxito
Module.prototype.hasValidationExpired = function() {
  const daysRemaining = this.getDaysRemainingForValidation();
  if (daysRemaining === null) return false;
  return daysRemaining === 0 && !this.isValidated();
};

// Obtener estado de validación completo
Module.prototype.getValidationStatus = function() {
  if (!this.launched_at) {
    return {
      status: 'not_launched',
      message: 'Módulo no lanzado aún'
    };
  }

  const daysSinceLaunch = this.getDaysSinceLaunch();
  const daysRemaining = this.getDaysRemainingForValidation();
  const salesNeeded = Math.max(0, this.validation_target_sales - this.total_sales);
  const isValidated = this.isValidated();
  const isExpired = this.hasValidationExpired();

  return {
    status: isValidated ? 'validated' : isExpired ? 'failed' : 'testing',
    daysSinceLaunch,
    daysRemaining,
    currentSales: this.total_sales,
    targetSales: this.validation_target_sales,
    salesNeeded,
    isValidated,
    isExpired,
    validatedAt: this.validated_at,
    message: isValidated 
      ? '¡Validado! Target alcanzado' 
      : isExpired 
        ? 'Periodo expirado sin alcanzar target'
        : `${salesNeeded} ventas más en ${daysRemaining} días`
  };
};

export default Module;
