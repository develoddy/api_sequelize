import { DataTypes } from 'sequelize';
import { experimentsSequelize } from '../../../../database/experiments.database.js';

export const RaffleNumber = experimentsSequelize.define('RaffleNumber', {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
    },
    draw_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
            model: 'raffle_draws',
            key: 'id',
        },
    },
    value: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
    },
    status: {
        type: DataTypes.ENUM('available', 'pending', 'confirmed'),
        allowNull: false,
        defaultValue: 'available',
    },
}, {
    tableName: 'raffle_numbers',
    timestamps: false,
    indexes: [
        {
            name: 'uq_raffle_numbers_draw_value',
            unique: true,
            fields: ['draw_id', 'value'],
        },
    ],
});
