import { DataTypes } from 'sequelize';
import { experimentsSequelize } from '../../../../database/experiments.database.js';

export const RafflePrize = experimentsSequelize.define('RafflePrize', {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
    },
    draw_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
    },
    position: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
    },
    title: {
        type: DataTypes.STRING(200),
        allowNull: false,
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    image_path: {
        type: DataTypes.STRING(500),
        allowNull: true,
    },
}, {
    tableName: 'raffle_prizes',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        {
            unique: true,
            name: 'raffle_prizes_draw_position_unique',
            fields: ['draw_id', 'position'],
        },
    ],
});
