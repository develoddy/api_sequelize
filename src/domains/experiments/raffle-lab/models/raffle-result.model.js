import { DataTypes } from 'sequelize';
import { experimentsSequelize } from '../../../../database/experiments.database.js';

export const RaffleResult = experimentsSequelize.define('RaffleResult', {
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
    prize_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
    },
    number_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
    },
}, {
    tableName: 'raffle_results',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        {
            unique: true,
            name: 'raffle_results_prize_unique',
            fields: ['prize_id'],
        },
        {
            unique: true,
            name: 'raffle_results_draw_number_unique',
            fields: ['draw_id', 'number_id'],
        },
    ],
});
