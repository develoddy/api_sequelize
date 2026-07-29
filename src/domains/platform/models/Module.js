import { sequelize } from '../../../database/database.js';
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
  tagline: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Frase corta de gancho para marketing'
  },
  detailed_description: {
    type: DataTypes.TEXT('long'),
    allowNull: true,
    comment: 'Descripción larga para la landing page (soporta HTML/Markdown)'
  },
  type: {
    type: DataTypes.ENUM('physical', 'digital', 'service', 'integration', 'saas'),
    defaultValue: 'physical',
    allowNull: false,
    comment: 'Tipo de módulo: physical (merch), digital (ZIP), service (consultoría), integration (herramienta), saas (subscripción)'
  },
  
  // Estado y validación
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false
  },
  show_in_store: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false,
    comment: 'Si el módulo se muestra en el MVP Hub público'
  },
  status: {
    type: DataTypes.ENUM('draft', 'testing', 'live', 'archived'),
    defaultValue: 'draft',
    allowNull: false
  },
  module_type: {
    type: DataTypes.ENUM('landing', 'wizard', 'live'),
    defaultValue: 'wizard',
    allowNull: false,
    comment: 'Validation stage: landing (pain/demand validation), wizard (solution validation), or live (full product)'
  },
  
  // Phase tracking and relationships
  parent_module_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'modules',
      key: 'id'
    },
    comment: 'Parent module for phase progression (landing → wizard → live)'
  },
  concept_name: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Base concept name without phase suffix (e.g., "inbox-zero-prevention")'
  },
  phase_order: {
    type: DataTypes.TINYINT,
    defaultValue: 0,
    allowNull: false,
    comment: 'Phase order: 0=landing, 1=wizard, 2=live'
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
  },
  
  // 🆕 Marketing y contenido visual
  screenshots: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
    comment: 'Array de URLs de screenshots/imágenes del producto'
  },
  download_url: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: 'URL del archivo descargable (ZIP con código, docs, etc.)'
  },
  post_purchase_email: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Template HTML del email que se envía post-compra'
  },
  features: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
    comment: 'Lista de features/beneficios del producto'
  },
  tech_stack: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
    comment: 'Tecnologías usadas (Node.js, Angular, etc.)'
  },
  requirements: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {},
    comment: 'Requerimientos técnicos para instalar/usar'
  },
  
  // 🆕 Configuración SaaS
  saas_config: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: null,
    comment: `Configuración específica para módulos SaaS: {
      trial_days: 14,
      api_endpoint: '/newsletter',
      dashboard_route: '/newsletter',
      pricing: [
        { 
          name: 'Starter', 
          price: 9, 
          interval: 'month',
          features: ['Feature 1', 'Feature 2'],
          stripe_price_id: 'price_xxx'
        }
      ],
      features_by_plan: {
        starter: ['feature_a', 'feature_b'],
        pro: ['feature_a', 'feature_b', 'feature_c']
      }
    }`
  },
  
  // 🎯 Preview Mode Configuration (Generic for any module)
  preview_config: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: null,
    comment: `Configuración del modo preview público para validación sin login: {
      enabled: true,
      route: '/preview/mailflow',
      public_endpoint: '/api/modules/mailflow/preview/generate',
      show_in_store: true,
      demo_button_text: 'Try Demo - No signup required',
      generator_function: 'generateMailflowPreview',
      conversion_config: {
        recovery_key: 'mailflow_preview',
        redirect_route: '/mailflow/onboarding',
        auto_activate: true
      },
      rate_limiting: {
        max_requests: 10,
        window_minutes: 15
      }
    }`
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

// 🆕 Métodos para SaaS

// Verificar si el módulo es SaaS
Module.prototype.isSaaS = function() {
  return this.type === 'saas';
};

// Obtener planes de pricing del SaaS
Module.prototype.getSaaSPricing = function() {
  if (!this.isSaaS() || !this.saas_config) return [];
  return this.saas_config.pricing || [];
};

// Obtener días de trial
Module.prototype.getTrialDays = function() {
  if (!this.isSaaS() || !this.saas_config) return 0;
  return this.saas_config.trial_days || 14;
};

// Obtener ruta del dashboard
Module.prototype.getDashboardRoute = function() {
  if (!this.isSaaS() || !this.saas_config) return null;
  return this.saas_config.dashboard_route || `/${this.key}`;
};

// Obtener endpoint de la API
Module.prototype.getApiEndpoint = function() {
  if (!this.isSaaS() || !this.saas_config) return null;
  return this.saas_config.api_endpoint || `/${this.key}`;
};

// 🎯 Métodos para Preview Mode

// Verificar si el módulo tiene preview habilitado
Module.prototype.hasPreviewEnabled = function() {
  return this.preview_config && this.preview_config.enabled === true;
};

// Obtener configuración de preview
Module.prototype.getPreviewConfig = function() {
  if (!this.hasPreviewEnabled()) return null;
  return this.preview_config;
};

// Obtener ruta pública del preview
Module.prototype.getPreviewRoute = function() {
  if (!this.hasPreviewEnabled()) return null;
  return this.preview_config.route || `/preview/${this.key}`;
};

// Obtener texto del botón demo
Module.prototype.getDemoButtonText = function() {
  if (!this.hasPreviewEnabled()) return null;
  return this.preview_config.demo_button_text || 'Try Demo';
};

// Verificar si debe mostrar botón en tienda
Module.prototype.shouldShowInStore = function() {
  return this.hasPreviewEnabled() && this.preview_config.show_in_store === true;
};

// Obtener configuración de rate limiting
Module.prototype.getPreviewRateLimiting = function() {
  if (!this.hasPreviewEnabled() || !this.preview_config.rate_limiting) {
    return { max_requests: 10, window_minutes: 15 };
  }
  return this.preview_config.rate_limiting;
};

// ========================================
// RELATIONSHIPS: Phase Progression
// ========================================

// Self-referential relationship for parent module
Module.belongsTo(Module, {
  as: 'parent',
  foreignKey: 'parent_module_id',
  constraints: false
});

// Self-referential relationship for child modules
Module.hasMany(Module, {
  as: 'children',
  foreignKey: 'parent_module_id',
  constraints: false
});

/**
 * Get all phases of this concept (parent + siblings + children)
 * @returns {Promise<Module[]>}
 */
Module.prototype.getConceptFamily = async function() {
  if (!this.concept_name) return [this];
  
  return await Module.findAll({
    where: { concept_name: this.concept_name },
    order: [['phase_order', 'ASC']]
  });
};

/**
 * Get the next phase in the progression
 * @returns {Promise<Module|null>}
 */
Module.prototype.getNextPhase = async function() {
  return await Module.findOne({
    where: {
      parent_module_id: this.id
    },
    order: [['phase_order', 'ASC']]
  });
};

/**
 * Check if this module can progress to the next phase
 * @param {Object} analytics - Current analytics data
 * @returns {Object} { canProgress: boolean, reason: string }
 */
Module.prototype.canProgressToNextPhase = function(analytics) {
  const progressionRules = {
    landing: {
      minHealthScore: 60,
      minSessions: 20,
      minWaitlist: 10,
      nextPhase: 'wizard'
    },
    wizard: {
      minHealthScore: 70,
      minCompletions: 50,
      minConversionRate: 40,
      nextPhase: 'live'
    },
    live: {
      nextPhase: null // No next phase
    }
  };

  const rules = progressionRules[this.module_type];
  if (!rules || !rules.nextPhase) {
    return { canProgress: false, reason: 'Already at final phase' };
  }

  if (this.module_type === 'landing') {
    if (analytics.health_score < rules.minHealthScore) {
      return { canProgress: false, reason: `Health score must be ≥ ${rules.minHealthScore} (current: ${analytics.health_score})` };
    }
    if (analytics.totalSessions < rules.minSessions) {
      return { canProgress: false, reason: `Need ≥ ${rules.minSessions} sessions (current: ${analytics.totalSessions})` };
    }
    if ((analytics.landing_metrics?.waitlist_signups || 0) < rules.minWaitlist) {
      return { canProgress: false, reason: `Need ≥ ${rules.minWaitlist} waitlist signups (current: ${analytics.landing_metrics?.waitlist_signups || 0})` };
    }
  } else if (this.module_type === 'wizard') {
    if (analytics.health_score < rules.minHealthScore) {
      return { canProgress: false, reason: `Health score must be ≥ ${rules.minHealthScore} (current: ${analytics.health_score})` };
    }
    if (analytics.wizard_completions < rules.minCompletions) {
      return { canProgress: false, reason: `Need ≥ ${rules.minCompletions} completions (current: ${analytics.wizard_completions})` };
    }
    if (analytics.conversion_rate < rules.minConversionRate) {
      return { canProgress: false, reason: `Conversion rate must be ≥ ${rules.minConversionRate}% (current: ${analytics.conversion_rate}%)` };
    }
  }

  return { canProgress: true, reason: 'All criteria met', nextPhase: rules.nextPhase };
};

export default Module;
