import { DataTypes } from 'sequelize';
import { sequelize } from '../database/database.js';

/**
 * Modelo de Secuencia de Onboarding de MailFlow
 * Representa una secuencia de emails automatizada para onboarding
 */
export const MailflowSequence = sequelize.define('MailflowSequence', {
    sequenceId: {
        type: DataTypes.STRING(50),
        primaryKey: true,
        allowNull: false
    },
    tenantId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'ID del tenant SaaS (si aplica)'
    },
    userId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'ID del usuario propietario'
    },
    name: {
        type: DataTypes.STRING(255),
        allowNull: false,
        comment: 'Nombre de la secuencia'
    },
    businessType: {
        type: DataTypes.ENUM('ecommerce', 'saas', 'services', 'education', 'other'),
        allowNull: false,
        comment: 'Tipo de negocio'
    },
    goal: {
        type: DataTypes.ENUM('first-purchase', 'trial-conversion', 'engagement', 'onboarding'),
        allowNull: false,
        comment: 'Objetivo de la secuencia'
    },
    brandName: {
        type: DataTypes.STRING(255),
        allowNull: false,
        comment: 'Nombre de la marca'
    },
    emailTone: {
        type: DataTypes.ENUM('friendly', 'professional', 'casual'),
        defaultValue: 'friendly',
        comment: 'Tono de comunicación'
    },
    emails: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: [],
        comment: 'Array de emails de la secuencia'
    },
    estimatedContacts: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Número estimado de contactos'
    },
    status: {
        type: DataTypes.ENUM('draft', 'active', 'paused', 'completed'),
        defaultValue: 'draft',
        comment: 'Estado de la secuencia'
    },
    activatedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Fecha de activación'
    },
    pausedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Fecha de pausa'
    },
    completedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Fecha de finalización'
    },
    stats: {
        type: DataTypes.JSON,
        defaultValue: {
            sent: 0,
            pending: 0,
            failed: 0,
            opened: 0
        },
        comment: 'Estadísticas de la secuencia'
    }
}, {
    tableName: 'mailflow_sequences',
    timestamps: true,
    indexes: [
        { fields: ['tenantId'] },
        { fields: ['userId'] },
        { fields: ['status'] },
        { fields: ['createdAt'] }
    ]
});
