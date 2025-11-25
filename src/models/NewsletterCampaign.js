import { DataTypes } from "sequelize";
import { sequelize } from "../database/database.js";

export const NewsletterCampaign = sequelize.define('newsletter_campaigns', {
    id: { 
        type: DataTypes.INTEGER, 
        autoIncrement: true, 
        primaryKey: true
    },
    name: {
        type: DataTypes.STRING(250),
        allowNull: false,
        comment: 'Nombre interno de la campaña'
    },
    subject: {
        type: DataTypes.STRING(500),
        allowNull: false,
        comment: 'Asunto del email'
    },
    html_body: {
        type: DataTypes.TEXT('long'),
        allowNull: false,
        comment: 'Contenido HTML del email'
    },
    filters: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Filtros aplicados (source, utm, dateRange, segment)'
    },
    status: {
        type: DataTypes.ENUM('draft', 'scheduled', 'sending', 'completed', 'failed'),
        defaultValue: 'draft'
    },
    scheduled_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Fecha programada para envío'
    },
    sent_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Fecha real de envío'
    },
    total_recipients: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    sent_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    delivered_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    failed_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    opened_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Emails abiertos (si hay tracking)'
    },
    clicked_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Clicks en links (si hay tracking)'
    },
    created_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'ID del admin que creó la campaña'
    },
    test_emails: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Array de emails de prueba enviados'
    },
    error_log: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Log de errores durante el envío'
    },
    campaign_type: {
        type: DataTypes.ENUM('novedades', 'promociones', 'prelaunch', 'general'),
        allowNull: false,
        defaultValue: 'general',
        comment: 'Tipo de campaña para filtrar por preferencias de usuarios'
    }
}, {
    timestamps: true,
    tableName: 'newsletter_campaigns',
    indexes: [
        {
            fields: ['status']
        },
        {
            fields: ['createdAt']
        },
        {
            fields: ['created_by']
        }
    ]
});
