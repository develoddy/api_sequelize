import { Op } from 'sequelize';
import { RaffleReservation } from '../models/raffle-associations.js';
import { expireReservation } from './raffle-reservations.service.js';

export async function processExpiredReservations({ limit = 50 } = {}) {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
        throw new Error('Límite de procesamiento inválido.');
    }

    const reservations = await RaffleReservation.findAll({
        attributes: ['id'],
        where: {
            status: 'active',
            expires_at: {
                [Op.lte]: new Date(),
            },
        },
        order: [
            ['expires_at', 'ASC'],
            ['id', 'ASC'],
        ],
        limit,
    });

    const result = {
        selected: reservations.length,
        expired: 0,
        alreadyExpired: 0,
        failed: 0,
    };

    for (const reservation of reservations) {
        try {
            await expireReservation({
                reservationId: reservation.id,
            });

            result.expired += 1;
        } catch (error) {
            try {
                const current = await RaffleReservation.findByPk(
                    reservation.id,
                    { attributes: ['status'] }
                );

                if (current?.status === 'expired') {
                    result.alreadyExpired += 1;
                    continue;
                }
            } catch (lookupError) {
                console.error(
                    `[Raffle Lab] Error consultando reserva ${reservation.id}:`,
                    lookupError
                );
            }

            result.failed += 1;

            console.error(
                `[Raffle Lab] Error expirando reserva ${reservation.id}:`,
                error
            );
        }
    }

    return result;
}
