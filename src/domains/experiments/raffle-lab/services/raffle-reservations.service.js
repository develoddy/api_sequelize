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
            lock: transaction.LOCK.UPDATE,
        });

        if (!draw) {
            throw new Error('Sorteo no encontrado.');
        }

        if (draw.status !== 'published') {
            throw new Error('El sorteo no está disponible para reservas.');
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


export async function confirmReservation({ reservationId }) {
    if (
        !Number.isSafeInteger(reservationId) ||
        reservationId < 1 ||
        reservationId > 4294967295
    ) {
        throw new Error('Identificador de reserva inválido.');
    }

    return experimentsSequelize.transaction(async (transaction) => {
        const reservation = await RaffleReservation.findByPk(
            reservationId,
            {
                transaction,
                lock: transaction.LOCK.UPDATE,
            }
        );

        if (!reservation) {
            throw new Error('Reserva no encontrada.');
        }

        if (reservation.status !== 'active') {
            throw new Error('La reserva no está activa.');
        }

        if (
            reservation.expires_at !== null &&
            new Date(reservation.expires_at).getTime() <= Date.now()
        ) {
            throw new Error('La reserva ha expirado.');
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
                draw_id: reservation.draw_id,
            },
            order: [['id', 'ASC']],
            transaction,
            lock: transaction.LOCK.UPDATE,
        });

        if (
            numbers.length !== numberIds.length ||
            numbers.some(number => number.status !== 'pending')
        ) {
            throw new Error('Los números de la reserva no están pendientes.');
        }

        if (
            reservation.expires_at !== null &&
            new Date(reservation.expires_at).getTime() <= Date.now()
        ) {
            throw new Error('La reserva ha expirado.');
        }

        for (const number of numbers) {
            await number.update(
                { status: 'confirmed' },
                { transaction }
            );
        }

        await reservation.update(
            { status: 'confirmed' },
            { transaction }
        );

        return reservation;
    });
}


export async function cancelReservation({ reservationId }) {
    if (
        !Number.isSafeInteger(reservationId) ||
        reservationId < 1 ||
        reservationId > 4294967295
    ) {
        throw new Error('Identificador de reserva inválido.');
    }

    return experimentsSequelize.transaction(async (transaction) => {
        const reservation = await RaffleReservation.findByPk(
            reservationId,
            {
                transaction,
                lock: transaction.LOCK.UPDATE,
            }
        );

        if (!reservation) {
            throw new Error('Reserva no encontrada.');
        }

        if (reservation.status !== 'active') {
            throw new Error('La reserva no está activa.');
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
                draw_id: reservation.draw_id,
            },
            order: [['id', 'ASC']],
            transaction,
            lock: transaction.LOCK.UPDATE,
        });

        if (
            numbers.length !== numberIds.length ||
            numbers.some(number => number.status !== 'pending')
        ) {
            throw new Error('Los números de la reserva no están pendientes.');
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


export async function expireReservation({ reservationId }) {
    if (
        !Number.isSafeInteger(reservationId) ||
        reservationId < 1 ||
        reservationId > 4294967295
    ) {
        throw new Error('Identificador de reserva inválido.');
    }

    return experimentsSequelize.transaction(async (transaction) => {
        const reservation = await RaffleReservation.findByPk(
            reservationId,
            {
                transaction,
                lock: transaction.LOCK.UPDATE,
            }
        );

        if (!reservation) {
            throw new Error('Reserva no encontrada.');
        }

        if (reservation.status !== 'active') {
            throw new Error('La reserva no está activa.');
        }

        if (
            reservation.expires_at === null ||
            new Date(reservation.expires_at).getTime() > Date.now()
        ) {
            throw new Error('La reserva todavía no ha expirado.');
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
                draw_id: reservation.draw_id,
            },
            order: [['id', 'ASC']],
            transaction,
            lock: transaction.LOCK.UPDATE,
        });

        if (
            numbers.length !== numberIds.length ||
            numbers.some(number => number.status !== 'pending')
        ) {
            throw new Error('Los números de la reserva no están pendientes.');
        }

        for (const number of numbers) {
            await number.update(
                { status: 'available' },
                { transaction }
            );
        }

        await reservation.update(
            { status: 'expired' },
            { transaction }
        );

        return reservation;
    });
}
