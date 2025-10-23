import { DataTypes } from 'sequelize';
import { sequelize } from '../../database/database.js';
import { ChatConversation } from './ChatConversation.js';

export const ChatMessage = sequelize.define('ChatMessage', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  conversation_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  sender_type: {
    type: DataTypes.ENUM('user', 'agent', 'system'),
    allowNull: false
  },
  sender_id: {
    type: DataTypes.STRING,
    allowNull: true
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  is_read: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false
  }
}, {
  tableName: 'chat_messages',
  timestamps: true,
  underscored: true
});

// Definir relaciones
ChatMessage.belongsTo(ChatConversation, {
  foreignKey: 'conversation_id',
  as: 'conversation'
});

ChatConversation.hasMany(ChatMessage, {
  foreignKey: 'conversation_id',
  as: 'messages'
});

//module.exports = ChatMessage;