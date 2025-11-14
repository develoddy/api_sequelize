// models/Inbox.js
import { DataTypes } from 'sequelize';
import { sequelize } from '../database/database.js';

export const Inbox = sequelize.define('inboxes', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    subject: { type: DataTypes.STRING(250), allowNull: false },
    body: { type: DataTypes.TEXT, allowNull: false },
    status: { type: DataTypes.ENUM('unread', 'read'), defaultValue: 'unread' },
    type: { type: DataTypes.STRING(50), allowNull: true },
    sentAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    receivedAt: { type: DataTypes.DATE, allowNull: true },
    userId: { type: DataTypes.INTEGER, allowNull: true },
    guestId: { type: DataTypes.INTEGER, allowNull: true },
    replyToId: { type: DataTypes.INTEGER, allowNull: true },
}, {
    timestamps: true,
    tableName: 'inboxes',
});