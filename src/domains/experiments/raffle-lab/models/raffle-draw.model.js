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
    total_numbers: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
    },
}, {
    tableName: 'raffle_draws',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});
