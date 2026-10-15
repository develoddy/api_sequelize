import { experimentsSequelize } from '../../../../database/experiments.database.js';
import { Op } from 'sequelize';
import {
    RaffleDraw,
    RaffleNumber,
    RaffleReservation,
    RaffleReservationNumber,
} from '../models/raffle-associations.js';
import {
    validateReservationInput,
} from './raffle-reservation.validation.js';

export async function createReservation({
    drawId,
    participantName,
    values,
    durationMinutes = 15,
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
        values,
        durationMinutes
    );

    if (!input) {
        throw new Error('Datos de reserva inválidos.');
    }

    return experimentsSequelize.transaction(async (transaction) => {
        const draw = await RaffleDraw.findByPk(drawId, {
            transaction,
        });

        if (!draw) {
            throw new Error('Sorteo no encontrado.');
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

        const expiresAt = new Date(
            Date.now() + input.durationMilliseconds
        );

        if (
            !Number.isFinite(expiresAt.getTime()) ||
            expiresAt.getTime() > Date.parse('9999-12-31T23:59:59.000Z')
        ) {
            throw new Error('Fecha de expiración inválida.');
        }

        const reservation = await RaffleReservation.create({
            draw_id: drawId,
            participant_name: input.participantName,
            status: 'active',
            expires_at: expiresAt,
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
                { status: 'pending' },
                { transaction }
            );
        }

        return reservation;

    });
}
