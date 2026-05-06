import { DataTypes } from 'sequelize';
import { sequelize } from '../database/database.js';

/**
 * Modelo de Log de Emails de MailFlow
 * Registra TODOS los intentos de envío de emails (exitosos y fallidos)
 * 
 * CRÍTICO para producción:
 * - Auditoría completa de envíos
 * - Prevención de duplicados
 * - Debugging de problemas SMTP
 * - Análisis de fallos
 */
export const MailflowEmailLog = sequelize.define('MailflowEmailLog', {
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
        },
        comment: 'ID de la secuencia'
    },
    contactId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'mailflow_contacts',
            key: 'id'
        },
        comment: 'ID del contacto'
    },
    email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        comment: 'Email del destinatario (desnormalizado para queries rápidas)'
    },
    emailIndex: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'Índice del email en la secuencia (0-based)'
    },
    subject: {
        type: DataTypes.STRING(500),
        allowNull: true,
        comment: 'Subject del email enviado'
    },
    status: {
        type: DataTypes.ENUM('sent', 'failed', 'retry'),
        allowNull: false,
        comment: 'Estado del envío'
    },
    attemptNumber: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
        comment: 'Número de intento (para reintentos)'
    },
    smtpMessageId: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'Message ID devuelto por SMTP (si exitoso)'
    },
    smtpResponse: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Respuesta completa del servidor SMTP'
    },
    errorCode: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: 'Código de error SMTP (si falló)'
    },
    errorMessage: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Mensaje de error detallado (si falló)'
    },
    sentAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        comment: 'Timestamp del intento de envío'
    },
    retryAt: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Timestamp para próximo reintento (si aplica)'
    },
    metadata: {
        type: DataTypes.JSON,
        defaultValue: {},
        comment: 'Datos adicionales (IP, user agent, etc.)'
    }
}, {
    tableName: 'mailflow_email_logs',
    timestamps: false, // Usamos sentAt manualmente
    indexes: [
        { fields: ['sequenceId'] },
        { fields: ['contactId'] },
        { fields: ['email'] },
        { fields: ['status'] },
        { fields: ['sentAt'] },
        { fields: ['emailIndex'] },
        // Índice compuesto para prevención de duplicados
        { fields: ['contactId', 'emailIndex', 'status'] },
        // Índice para búsqueda de reintentos pendientes
        { fields: ['status', 'retryAt'] }
    ]
});
