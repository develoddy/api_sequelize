import { DataTypes } from 'sequelize';
import { sequelize } from '../../database/database.js';
import moment from 'moment-timezone';

export const TenantChatConfig = sequelize.define('TenantChatConfig', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  tenant_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true,
    comment: 'ID del tenant en la tabla modules_tenants'
  },
  widget_color: {
    type: DataTypes.STRING(7),
    defaultValue: '#4F46E5',
    comment: 'Color principal del widget (hex)'
  },
  widget_position: {
    type: DataTypes.ENUM('bottom-right', 'bottom-left'),
    defaultValue: 'bottom-right'
  },
  welcome_message: {
    type: DataTypes.TEXT,
    defaultValue: '👋 ¡Hola! ¿En qué podemos ayudarte?'
  },
  business_hours: {
    type: DataTypes.JSON,
    defaultValue: {
      monday: { open: '09:00', close: '18:00', enabled: true },
      tuesday: { open: '09:00', close: '18:00', enabled: true },
      wednesday: { open: '09:00', close: '18:00', enabled: true },
      thursday: { open: '09:00', close: '18:00', enabled: true },
      friday: { open: '09:00', close: '18:00', enabled: true },
      saturday: { open: '10:00', close: '14:00', enabled: false },
      sunday: { open: '10:00', close: '14:00', enabled: false }
    }
  },
  timezone: {
    type: DataTypes.STRING(50),
    defaultValue: 'Europe/Madrid'
  },
  auto_response_enabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  capture_leads: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  allowed_domains: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  iframe_url: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: 'URL del iframe para MVP (temporal)'
  },
  max_agents: {
    type: DataTypes.INTEGER,
    defaultValue: 5
  },
  integration_type: {
    type: DataTypes.ENUM('iframe', 'crisp', 'intercom', 'native'),
    defaultValue: 'iframe',
    comment: 'Tipo de integración del chat'
  },
  integration_config: {
    type: DataTypes.JSON,
    defaultValue: {}
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'tenant_chat_config',
  timestamps: true,
  underscored: true
});

// Método helper para validar si está en horario de atención
TenantChatConfig.prototype.isWithinBusinessHours = function() {
  // Si no hay business_hours configurado, retornar true (siempre disponible)
  if (!this.business_hours) {
    return true;
  }
  
  const now = moment().tz(this.timezone);
  const dayName = now.format('dddd').toLowerCase();
  const currentTime = now.format('HH:mm');
  
  const dayConfig = this.business_hours[dayName];
  if (!dayConfig || !dayConfig.enabled) {
    return false;
  }
  
  return currentTime >= dayConfig.open && currentTime <= dayConfig.close;
};

// Método helper para generar URL del iframe
TenantChatConfig.prototype.getIframeEmbedCode = function() {
  const baseUrl = process.env.URL_APP_SAAS || 'http://localhost:4202';
  const iframeUrl = `${baseUrl}/chat/widget/${this.tenant_id}`;
  
  return `<!-- Smart Chat Widget -->
<iframe 
  src="${iframeUrl}" 
  style="position:fixed;bottom:20px;right:20px;width:400px;height:600px;border:none;border-radius:12px;box-shadow:0 10px 40px rgba(0,0,0,0.15);z-index:9999;"
  title="Chat de soporte"
></iframe>`;
};
