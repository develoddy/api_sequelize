import { Op } from 'sequelize';

import {
    RaffleDraw,
    RaffleNumber,
    RaffleReservation,
} from '../models/raffle-associations.js';

import {
    confirmReservation,
    cancelReservation,
} from '../services/raffle-reservations.service.js';

import {
    createAdminReservation,
} from '../services/raffle-reservations-admin.service.js';

function parseId(value) {
    if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) {
        return null;
    }

    const id = Number(value);

    return Number.isSafeInteger(id) && id <= 4294967295
        ? id
        : null;
}

function serializeReservation(reservation) {
    return {
        id: reservation.id,
        drawId: reservation.draw_id,
        participantName: reservation.participant_name,
        status: reservation.status,
        expiresAt: reservation.expires_at,
        createdAt: reservation.created_at,
        numbers: (reservation.numbers ?? [])
            .map(number => ({
                value: number.value,
                status: number.status,
            }))
            .sort((a, b) => a.value - b.value),
    };
}

export async function listAdminReservations(req, res) {
    try {
        const drawId = parseId(req.params.drawId);

        if (!drawId) {
            return res.status(400).json({
                success: false,
                message: 'Identificador de sorteo inválido.',
            });
        }

        const rawPage = req.query.page ?? '1';
        const rawLimit = req.query.limit ?? '20';

        if (
            typeof rawPage !== 'string' ||
            typeof rawLimit !== 'string' ||
            !/^[1-9]\d*$/.test(rawPage) ||
            !/^[1-9]\d*$/.test(rawLimit)
        ) {
            return res.status(400).json({
                success: false,
                message: 'Paginación inválida.',
            });
        }

        const page = Number(rawPage);
        const limit = Number(rawLimit);

        if (
            !Number.isSafeInteger(page) ||
            !Number.isSafeInteger(limit) ||
            limit > 100 ||
            page > 1000000
        ) {
            return res.status(400).json({
                success: false,
                message: 'Paginación inválida.',
            });
        }

        const draw = await RaffleDraw.findByPk(drawId, {
            attributes: ['id'],
        });

        if (!draw) {
            return res.status(404).json({
                success: false,
                message: 'Sorteo no encontrado.',
            });
        }

        const { count, rows } = await RaffleReservation.findAndCountAll({
            where: { draw_id: drawId },
            include: [{
                model: RaffleNumber,
                as: 'numbers',
                attributes: ['id', 'value', 'status'],
                through: { attributes: [] },
                required: false,
            }],
            distinct: true,
            order: [['id', 'DESC']],
            limit,
            offset: (page - 1) * limit,
        });

        return res.status(200).json({
            success: true,
            data: {
                drawId,
                reservations: rows.map(serializeReservation),
                pagination: {
                    page,
                    limit,
                    total: count,
                    totalPages: Math.ceil(count / limit),
                },
            },
        });

    } catch (error) {
        console.error('[Raffle Lab] Error consultando reservas:', error);

        return res.status(500).json({
            success: false,
            message: 'No se pudieron consultar las reservas.',
        });
    }
}

async function changeReservation(req, res, operation) {
    const reservationId = parseId(req.params.reservationId);

    if (!reservationId) {
        return res.status(400).json({
            success: false,
            message: 'Identificador de reserva inválido.',
        });
    }

    try {
        const reservation = await operation({ reservationId });

        return res.status(200).json({
            success: true,
            data: {
                id: reservation.id,
                drawId: reservation.draw_id,
                status: reservation.status,
            },
        });

    } catch (error) {
        const message = error.message;

        if (message === 'Reserva no encontrada.') {
            return res.status(404).json({
                success: false,
                message,
            });
        }

        const conflictMessages = new Set([
            'La reserva no está activa.',
            'El sorteo no admite confirmaciones de reservas.',
            'La reserva no pertenece al sorteo.',
            'La reserva ha expirado.',
            'La reserva no tiene números asociados.',
            'Los números de la reserva no están pendientes.',
        ]);

        if (conflictMessages.has(message)) {
            return res.status(409).json({
                success: false,
                message,
            });
        }

        console.error('[Raffle Lab] Error actualizando reserva:', error);

        return res.status(500).json({
            success: false,
            message: 'No se pudo actualizar la reserva.',
        });
    }
}

export async function confirmAdminReservation(req, res) {
    return changeReservation(req, res, confirmReservation);
}

export async function cancelAdminReservation(req, res) {
    return changeReservation(req, res, cancelReservation);
}

export async function createAdminManualReservation(req, res) {
    const drawId = parseId(req.params.drawId);

    if (!drawId) {
        return res.status(400).json({
            success: false,
            message: 'Identificador de sorteo inválido.',
        });
    }

    try {
        const reservation = await createAdminReservation({
            drawId,
            participantName: req.body?.participantName,
            values: req.body?.values,
            paymentStatus: req.body?.paymentStatus,
        });

        return res.status(201).json({
            success: true,
            data: {
                id: reservation.id,
                drawId: reservation.draw_id,
                participantName: reservation.participant_name,
                status: reservation.status,
                source: reservation.source,
                expiresAt: reservation.expires_at,
            },
        });
    } catch (error) {
        const message = error.message;

        if (
            message === 'Identificador de sorteo inválido.' ||
            message === 'Datos de reserva inválidos.'
        ) {
            return res.status(400).json({
                success: false,
                message,
            });
        }

        if (message === 'Sorteo no encontrado.') {
            return res.status(404).json({
                success: false,
                message,
            });
        }

        if ([
            'El sorteo no admite nuevas reservas.',
            'Número fuera del rango del sorteo.',
            'Uno o más números no existen en el sorteo.',
            'Uno o más números no están disponibles.',
        ].includes(message)) {
            return res.status(409).json({
                success: false,
                message,
            });
        }

        console.error(
            '[Raffle Lab] Error registrando reserva manual:',
            error
        );

        return res.status(500).json({
            success: false,
            message: 'No se pudo registrar la reserva manual.',
        });
    }
}
