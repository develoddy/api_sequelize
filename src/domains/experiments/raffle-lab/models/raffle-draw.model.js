import { DataTypes } from 'sequelize';
import { experimentsSequelize } from '../../../../database/experiments.database.js';

export const RaffleDraw = experimentsSequelize.define('RaffleDraw', {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
    },
    name: {
        type: DataTypes.STRING(150),
        allowNull: false,
    },
    headline: {
        type: DataTypes.STRING(200),
        allowNull: true,
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    banner_image: {
        type: DataTypes.STRING(500),
        allowNull: true,
    },
    banner_image_mobile: {
        type: DataTypes.STRING(500),
        allowNull: true,
    },
    ticket_price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
    },
    draw_date: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    whatsapp_number: {
        type: DataTypes.STRING(20),
        allowNull: true,
    },
    organizer_name: {
        type: DataTypes.STRING(150),
        allowNull: true,
    },
    total_numbers: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
    },
    status: {
        type: DataTypes.ENUM('draft', 'published', 'closed'),
        allowNull: false,
        defaultValue: 'draft',
    },
    results_published_at: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
    },
}, {
    tableName: 'raffle_draws',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});
