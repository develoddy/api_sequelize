import { DataTypes } from 'sequelize';
import { sequelize } from '../database/database.js';

/**
 * Modelo de Contacto de MailFlow
 * Representa los contactos importados para una secuencia
 */
export const MailflowContact = sequelize.define('MailflowContact', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    sequenceId: {
        type: DataTypes.STRING(50),
        allowNull: false,
        references: {
            model: 'mailflow_sequences',
            key: 'sequenceId'
        }
    },
    email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        validate: {
            isEmail: true
        }
    },
    name: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    status: {
        type: DataTypes.ENUM('pending', 'active', 'completed', 'failed', 'unsubscribed'),
        defaultValue: 'pending',
        comment: 'Estado del contacto en la secuencia'
    },
    currentEmailIndex: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Índice del próximo email a enviar (0-based)'
    },
    lastEmailSentAt: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Fecha del último email enviado'
    },
    nextEmailAt: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Fecha programada del próximo email'
    },
    stats: {
        type: DataTypes.JSON,
        defaultValue: {
            sent: 0,
            opened: 0,
            clicked: 0
        },
        comment: 'Estadísticas del contacto'
    },
    metadata: {
        type: DataTypes.JSON,
        defaultValue: {},
        comment: 'Datos adicionales del contacto'
    }
}, {
    tableName: 'mailflow_contacts',
    timestamps: true,
    indexes: [
        { fields: ['sequenceId'] },
        { fields: ['email'] },
        { fields: ['status'] },
        { fields: ['nextEmailAt'] },
        { unique: true, fields: ['sequenceId', 'email'] }
    ]
});
