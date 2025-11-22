import { DataTypes } from "sequelize";
import { sequelize } from "../database/database.js";

export const PrelaunchSubscriber = sequelize.define('prelaunch_subscribers', {
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
    session_id: { 
        type: DataTypes.STRING(100), 
        allowNull: true 
    },
    source: { 
        type: DataTypes.ENUM('main_form', 'cta_final'), 
        defaultValue: 'main_form',
        comment: 'Indica de qué formulario proviene la suscripción'
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
    notified_launch: { 
        type: DataTypes.BOOLEAN, 
        defaultValue: false,
        comment: 'Indica si ya fue notificado del lanzamiento'
    },
    coupon_sent: { 
        type: DataTypes.BOOLEAN, 
        defaultValue: false,
        comment: 'Indica si ya recibió el cupón exclusivo'
    }
}, {
    timestamps: true,
    tableName: 'prelaunch_subscribers',
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
        }
    ]
});