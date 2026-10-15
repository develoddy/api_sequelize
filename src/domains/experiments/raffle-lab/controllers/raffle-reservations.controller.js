import {
    createReservation,
} from '../services/raffle-reservations.service.js';

const MAX_NUMBERS_PER_RESERVATION = 10;
const RESERVATION_DURATION_MINUTES = 15;

export async function createRaffleReservation(req, res) {
    try {
        const { drawId, participantName, values } = req.body ?? {};

        if (
            !Number.isSafeInteger(drawId) ||
            drawId < 1 ||
            drawId > 4294967295 ||
            typeof participantName !== 'string' ||
            !participantName.trim() ||
            participantName.trim().length > 150 ||
            !Array.isArray(values) ||
            values.length < 1 ||
            values.length > MAX_NUMBERS_PER_RESERVATION
        ) {
            return res.status(400).json({
                success: false,
                message: 'Datos de reserva inválidos.',
            });
        }

        const reservation = await createReservation({
            drawId,
            participantName,
            values,
            durationMinutes: RESERVATION_DURATION_MINUTES,
        });

        return res.status(201).json({
            success: true,
            data: {
                id: reservation.id,
                drawId: reservation.draw_id,
                status: reservation.status,
                expiresAt: reservation.expires_at,
            },
        });
    } catch (error) {
        const message = error.message;

        if (
            message === 'Identificador de sorteo inválido.' ||
            message === 'Datos de reserva inválidos.' ||
            message === 'Número fuera del rango del sorteo.'
        ) {
            return res.status(400).json({
                success: false,
                message,
            });
        }

        if (
            message === 'Sorteo no encontrado.' ||
            message === 'Uno o más números no existen en el sorteo.'
        ) {
            return res.status(404).json({
                success: false,
                message,
            });
        }

        if (
            message === 'Uno o más números no están disponibles.' ||
            message === 'El sorteo no está disponible para reservas.'
        ) {
            return res.status(409).json({
                success: false,
                message,
            });
        }

        console.error('[Raffle Lab] Error creando reserva:', error);

        return res.status(500).json({
            success: false,
            message: 'No se pudo crear la reserva.',
        });
    }
}
