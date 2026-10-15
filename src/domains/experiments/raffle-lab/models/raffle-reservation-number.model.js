import { DataTypes } from 'sequelize';
import { experimentsSequelize } from '../../../../database/experiments.database.js';

export const RaffleReservationNumber = experimentsSequelize.define('RaffleReservationNumber', {
    reservation_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        allowNull: false,
        references: {
            model: 'raffle_reservations',
            key: 'id',
        },
    },
    number_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        allowNull: false,
        references: {
            model: 'raffle_numbers',
            key: 'id',
        },
    },
}, {
    tableName: 'raffle_reservation_numbers',
    timestamps: false,
    indexes: [
        {
            name: 'idx_raffle_reservation_numbers_number',
            fields: ['number_id'],
        },
    ],
});
