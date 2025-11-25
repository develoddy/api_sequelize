import { DataTypes } from "sequelize";
import { sequelize } from "../database/database.js";

export const NewsletterSubscriber = sequelize.define('newsletter_subscribers', {
    id: { 
        type: DataTypes.INTEGER, 
        autoIncrement: true, 
        primaryKey: true
    },
    email: { 
        type: DataTypes.STRING(250), 
        allowNull: false, 
        unique: true,
        validate: {
            isEmail: true
        }
    },
    userId: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'ID del usuario autenticado (NULL para guests)'
    },
    session_id: { 
        type: DataTypes.STRING(100), 
        allowNull: true 
    },
    source: { 
        type: DataTypes.ENUM('home', 'footer', 'checkout', 'campaign_import', 'admin'), 
        defaultValue: 'home',
        comment: 'Indica de dónde proviene la suscripción'
    },
    ip_address: { 
        type: DataTypes.STRING(45), 
        allowNull: true 
    },
    user_agent: { 
        type: DataTypes.TEXT, 
        allowNull: true 
    },
    referrer: { 
        type: DataTypes.STRING(500), 
        allowNull: true 
    },
    utm_source: { 
        type: DataTypes.STRING(100), 
        allowNull: true 
    },
    utm_medium: { 
        type: DataTypes.STRING(100), 
        allowNull: true 
    },
    utm_campaign: { 
        type: DataTypes.STRING(100), 
        allowNull: true 
    },
    status: { 
        type: DataTypes.ENUM('subscribed', 'unsubscribed', 'bounced'), 
        defaultValue: 'subscribed' 
    },
    email_verified: { 
        type: DataTypes.BOOLEAN, 
        defaultValue: false 
    },
    verification_token: { 
        type: DataTypes.STRING(100), 
        allowNull: true 
    },
    notified_campaign: { 
        type: DataTypes.BOOLEAN, 
        defaultValue: false,
        comment: 'Indica si ya fue notificado en la última campaña'
    },
    coupon_sent: { 
        type: DataTypes.BOOLEAN, 
        defaultValue: false,
        comment: 'Indica si ya recibió el cupón exclusivo'
    },
    preferences: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: null,
        comment: 'Preferencias de contenido y canales del suscriptor',
        get() {
            const rawValue = this.getDataValue('preferences');
            if (!rawValue) {
                // Valores por defecto si no hay preferencias guardadas
                return {
                    content: ['novedades', 'promociones', 'prelaunch'],
                    channels: ['email']
                };
            }
            return rawValue;
        }
    }
}, {
    timestamps: true,
    tableName: 'newsletter_subscribers',
    indexes: [
        {
            unique: true,
            fields: ['email']
        },
        {
            fields: ['status']
        },
        {
            fields: ['source']
        },
        {
            fields: ['createdAt']
        },
        {
            fields: ['email_verified']
        },
        {
            fields: ['userId']
        }
    ]
});
