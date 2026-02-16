import { DataTypes } from 'sequelize';
import { sequelize } from '../../database/database.js';
import crypto from 'crypto';

export const TenantAgent = sequelize.define('TenantAgent', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  tenant_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  agent_name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  agent_email: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  agent_avatar: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive', 'invited'),
    defaultValue: 'invited'
  },
  role: {
    type: DataTypes.ENUM('owner', 'agent', 'agent_readonly'),
    defaultValue: 'agent'
  },
  max_concurrent_chats: {
    type: DataTypes.INTEGER,
    defaultValue: 5
  },
  last_seen_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  invite_token: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  invite_expires_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'tenant_agents',
  timestamps: true,
  underscored: true
});

// Método para generar token de invitación
TenantAgent.prototype.generateInviteToken = function() {
  this.invite_token = crypto.randomBytes(32).toString('hex');
  this.invite_expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 días
  return this.invite_token;
};

// Método para validar token
TenantAgent.prototype.isInviteValid = function() {
  if (!this.invite_token || !this.invite_expires_at) {
    return false;
  }
  return new Date() < this.invite_expires_at;
};

// Método para activar agente
TenantAgent.prototype.activate = async function() {
  this.status = 'active';
  this.invite_token = null;
  this.invite_expires_at = null;
  this.last_seen_at = new Date();
  await this.save();
};

// Método estático para buscar por email y tenant
TenantAgent.findByEmailAndTenant = async function(email, tenantId) {
  return await this.findOne({
    where: {
      agent_email: email,
      tenant_id: tenantId
    }
  });
};

// Método estático para obtener agentes activos de un tenant
TenantAgent.getActiveTenantAgents = async function(tenantId) {
  return await this.findAll({
    where: {
      tenant_id: tenantId,
      status: 'active'
    },
    order: [['last_seen_at', 'DESC']]
  });
};
