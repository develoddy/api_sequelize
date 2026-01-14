import { sequelize } from '../database/database.js';
import { DataTypes } from 'sequelize';

/**
 * Model: TenantNote
 * Notas administrativas sobre tenants
 */

export const TenantNote = sequelize.define('TenantNote', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  tenant_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'tenants',
      key: 'id'
    }
  },
  note: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  note_type: {
    type: DataTypes.ENUM('general', 'support', 'billing', 'technical', 'cancellation'),
    defaultValue: 'general'
  },
  created_by: {
    type: DataTypes.STRING(100),
    defaultValue: 'admin',
    comment: 'Email o nombre del admin que creó la nota'
  },
  is_important: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'tenant_notes',
  timestamps: false
});

export default TenantNote;
