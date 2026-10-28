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

export async function updateAdminReservationParticipant({
    reservationId,
    participantName,
}) {
    if (
        !Number.isSafeInteger(reservationId) ||
        reservationId < 1 ||
        reservationId > 4294967295
    ) {
        throw new Error('Identificador de reserva inválido.');
    }

    if (
        typeof participantName !== 'string' ||
        !participantName.trim() ||
        participantName.trim().length > 150
    ) {
        throw new Error('Nombre de participante inválido.');
    }

    const normalizedName = participantName.trim();

    return experimentsSequelize.transaction(async (transaction) => {
        const reservationReference = await RaffleReservation.findByPk(
            reservationId,
            {
                attributes: ['draw_id'],
                transaction,
            }
        );

        if (!reservationReference) {
            throw new Error('Reserva no encontrada.');
        }

        const draw = await RaffleDraw.findByPk(
            reservationReference.draw_id,
            {
                transaction,
                lock: transaction.LOCK.UPDATE,
            }
        );

        if (!draw || !['draft', 'published'].includes(draw.status)) {
            throw new Error('El sorteo no admite modificaciones.');
        }

        const reservation = await RaffleReservation.findByPk(
            reservationId,
            {
                transaction,
                lock: transaction.LOCK.UPDATE,
            }
        );

        if (!reservation || reservation.draw_id !== draw.id) {
            throw new Error('Reserva no encontrada.');
        }

        if (!['active', 'confirmed'].includes(reservation.status)) {
            throw new Error('La reserva no admite modificaciones.');
        }

        await reservation.update(
            { participant_name: normalizedName },
            { transaction }
        );

        return reservation;
    });
}

export async function changeAdminReservationNumbers({
    reservationId,
    values,
}) {
    if (
        !Number.isSafeInteger(reservationId) ||
        reservationId < 1 ||
        reservationId > 4294967295
    ) {
        throw new Error('Identificador de reserva inválido.');
    }

    if (
        !Array.isArray(values) ||
        values.length === 0 ||
        values.some(value =>
            !Number.isSafeInteger(value) ||
            value < 1 ||
            value > 4294967295
        ) ||
        new Set(values).size !== values.length
    ) {
        throw new Error('Números de reserva inválidos.');
    }

    return experimentsSequelize.transaction(async transaction => {
        const reference = await RaffleReservation.findByPk(
            reservationId,
            {
                attributes: ['draw_id'],
                transaction,
            }
        );

        if (!reference) {
            throw new Error('Reserva no encontrada.');
        }

        const draw = await RaffleDraw.findByPk(reference.draw_id, {
            transaction,
            lock: transaction.LOCK.UPDATE,
        });

        if (!draw || !['draft', 'published'].includes(draw.status)) {
            throw new Error('El sorteo no admite modificaciones.');
        }

        const reservation = await RaffleReservation.findByPk(
            reservationId,
            {
                transaction,
                lock: transaction.LOCK.UPDATE,
            }
        );

        if (!reservation || reservation.draw_id !== draw.id) {
            throw new Error('Reserva no encontrada.');
        }

        if (!['active', 'confirmed'].includes(reservation.status)) {
            throw new Error('La reserva no admite modificaciones.');
        }

        if (values.some(value => value > draw.total_numbers)) {
            throw new Error('Número fuera del rango del sorteo.');
        }

        const currentLinks = await RaffleReservationNumber.findAll({
            where: { reservation_id: reservationId },
            transaction,
        });

        const currentIds = currentLinks.map(link => link.number_id);

        const requestedValues = [...values].sort((a, b) => a - b);

        const requestedNumbers = await RaffleNumber.findAll({
            where: {
                draw_id: draw.id,
                value: { [Op.in]: requestedValues },
            },
            transaction,
        });

        if (requestedNumbers.length !== requestedValues.length) {
            throw new Error('Uno o más números no existen en el sorteo.');
        }

        const affectedIds = [
            ...new Set([
                ...currentIds,
                ...requestedNumbers.map(number => number.id),
            ]),
        ].sort((a, b) => a - b);

        const affectedNumbers = await RaffleNumber.findAll({
            where: {
                id: { [Op.in]: affectedIds },
                draw_id: draw.id,
            },
            order: [['id', 'ASC']],
            transaction,
            lock: transaction.LOCK.UPDATE,
        });

        if (affectedNumbers.length !== affectedIds.length) {
            throw new Error('Los números de la reserva no son válidos.');
        }

        const currentIdSet = new Set(currentIds);
        const requestedIdSet = new Set(
            requestedNumbers.map(number => number.id)
        );

        const expectedStatus = reservation.status === 'confirmed'
            ? 'confirmed'
            : 'pending';

        for (const number of affectedNumbers) {
            if (currentIdSet.has(number.id)) {
                if (number.status !== expectedStatus) {
                    throw new Error(
                        'Los números actuales tienen un estado incompatible.'
                    );
                }
            } else if (number.status !== 'available') {
                throw new Error('Uno o más números no están disponibles.');
            }
        }

        await RaffleReservationNumber.destroy({
            where: { reservation_id: reservationId },
            transaction,
        });

        await RaffleReservationNumber.bulkCreate(
            requestedNumbers.map(number => ({
                reservation_id: reservationId,
                number_id: number.id,
            })),
            { transaction }
        );

        for (const number of affectedNumbers) {
            const nextStatus = requestedIdSet.has(number.id)
                ? expectedStatus
                : 'available';

            if (number.status !== nextStatus) {
                await number.update(
                    { status: nextStatus },
                    { transaction }
                );
            }
        }

        return {
            reservationId: reservation.id,
            drawId: draw.id,
            status: reservation.status,
            values: requestedValues,
        };
    });
}

export async function cancelAdminConfirmedReservation({
    reservationId,
}) {
    if (
        !Number.isSafeInteger(reservationId) ||
        reservationId < 1 ||
        reservationId > 4294967295
    ) {
        throw new Error('Identificador de reserva inválido.');
    }

    return experimentsSequelize.transaction(async transaction => {
        const reference = await RaffleReservation.findByPk(
            reservationId,
            {
                attributes: ['draw_id'],
                transaction,
            }
        );

        if (!reference) {
            throw new Error('Reserva no encontrada.');
        }

        const draw = await RaffleDraw.findByPk(reference.draw_id, {
            transaction,
            lock: transaction.LOCK.UPDATE,
        });

        if (!draw || !['draft', 'published'].includes(draw.status)) {
            throw new Error('El sorteo no admite modificaciones.');
        }

        const reservation = await RaffleReservation.findByPk(
            reservationId,
            {
                transaction,
                lock: transaction.LOCK.UPDATE,
            }
        );

        if (!reservation || reservation.draw_id !== draw.id) {
            throw new Error('Reserva no encontrada.');
        }

        if (reservation.status !== 'confirmed') {
            throw new Error('La reserva no está confirmada.');
        }

        const associations = await RaffleReservationNumber.findAll({
            where: { reservation_id: reservationId },
            order: [['number_id', 'ASC']],
            transaction,
        });

        if (associations.length === 0) {
            throw new Error('La reserva no tiene números asociados.');
        }

        const numberIds = associations.map(item => item.number_id);

        const numbers = await RaffleNumber.findAll({
            where: {
                id: { [Op.in]: numberIds },
                draw_id: draw.id,
            },
            order: [['id', 'ASC']],
            transaction,
            lock: transaction.LOCK.UPDATE,
        });

        if (
            numbers.length !== numberIds.length ||
            numbers.some(number => number.status !== 'confirmed')
        ) {
            throw new Error(
                'Los números de la reserva no están confirmados.'
            );
        }

        for (const number of numbers) {
            await number.update(
                { status: 'available' },
                { transaction }
            );
        }

        await reservation.update(
            { status: 'cancelled' },
            { transaction }
        );

        return reservation;
    });
}

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
