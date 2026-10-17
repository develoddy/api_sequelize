import { Op } from 'sequelize';
import { experimentsSequelize } from '../../../../database/experiments.database.js';
import {
    RaffleDraw,
    RaffleNumber,
    RaffleReservation,
    RaffleReservationNumber,
} from '../models/raffle-associations.js';
import {
    validateReservationInput,
} from './raffle-reservation.validation.js';

export async function createAdminReservation({
    drawId,
    participantName,
    values,
    paymentStatus,
}) {
    if (
        !Number.isSafeInteger(drawId) ||
        drawId < 1 ||
        drawId > 4294967295
    ) {
        throw new Error('Identificador de sorteo inválido.');
    }

    const input = validateReservationInput(
        participantName,
        values
    );

    if (!input || !['pending', 'paid'].includes(paymentStatus)) {
        throw new Error('Datos de reserva inválidos.');
    }

    return experimentsSequelize.transaction(async (transaction) => {
        const draw = await RaffleDraw.findByPk(drawId, {
            transaction,
            lock: transaction.LOCK.UPDATE,
        });

        if (!draw) {
            throw new Error('Sorteo no encontrado.');
        }

        if (!['draft', 'published'].includes(draw.status)) {
            throw new Error('El sorteo no admite nuevas reservas.');
        }

        const requestedValues = [...input.values].sort((a, b) => a - b);

        if (requestedValues.some(value => value > draw.total_numbers)) {
            throw new Error('Número fuera del rango del sorteo.');
        }

        const numbers = await RaffleNumber.findAll({
            where: {
                draw_id: drawId,
                value: { [Op.in]: requestedValues },
            },
            order: [['value', 'ASC']],
            transaction,
            lock: transaction.LOCK.UPDATE,
        });

        if (numbers.length !== requestedValues.length) {
            throw new Error('Uno o más números no existen en el sorteo.');
        }

        if (numbers.some(number => number.status !== 'available')) {
            throw new Error('Uno o más números no están disponibles.');
        }

        const isPaid = paymentStatus === 'paid';

        const reservation = await RaffleReservation.create({
            draw_id: drawId,
            participant_name: input.participantName,
            source: 'manual',
            status: isPaid ? 'confirmed' : 'active',
            expires_at: null,
        }, { transaction });

        await RaffleReservationNumber.bulkCreate(
            numbers.map(number => ({
                reservation_id: reservation.id,
                number_id: number.id,
            })),
            { transaction }
        );

        for (const number of numbers) {
            await number.update(
                { status: isPaid ? 'confirmed' : 'pending' },
                { transaction }
            );
        }

        return reservation;
    });
}
