import { DataTypes } from 'sequelize';
import { sequelize } from '../../database/database.js';

export const ChatConversation = sequelize.define('ChatConversation', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'ID del usuario si está autenticado'
  },
  guest_id: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'ID del invitado si no está autenticado'
  },
  session_id: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'ID de sesión único para identificar la conversación'
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },
  status: {
    type: DataTypes.ENUM('open', 'closed', 'pending'),
    defaultValue: 'open'
  },
  last_message: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  last_message_time: {
    type: DataTypes.DATE,
    allowNull: true
  },
  unread_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  agent_id: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'ID del agente asignado'
  },
}, {
  timestamps: false,
  tableName: 'chat_conversations'
});

//module.exports = ChatConversation;