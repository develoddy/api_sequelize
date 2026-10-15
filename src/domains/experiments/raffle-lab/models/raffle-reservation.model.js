import { DataTypes } from 'sequelize';
import { experimentsSequelize } from '../../../../database/experiments.database.js';

export const RaffleReservation = experimentsSequelize.define('RaffleReservation', {
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
    participant_name: {
        type: DataTypes.STRING(150),
        allowNull: false,
    },
    status: {
        type: DataTypes.ENUM('active', 'confirmed', 'cancelled', 'expired'),
        allowNull: false,
        defaultValue: 'active',
    },
    expires_at: {
        type: DataTypes.DATE,
        allowNull: false,
    },
}, {
    tableName: 'raffle_reservations',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
        {
            name: 'idx_raffle_reservations_draw_status_expiry',
            fields: ['draw_id', 'status', 'expires_at'],
        },
    ],
});
