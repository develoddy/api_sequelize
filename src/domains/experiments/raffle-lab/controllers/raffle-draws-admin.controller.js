import {
    createAdminRaffleDraw,
    changeAdminRaffleDrawStatus,
} from '../services/raffle-draws-admin.service.js';

function sendError(res, error) {
    const message = error.message;

    if (
        message === 'Datos de sorteo inválidos.' ||
        message === 'Identificador de sorteo inválido.' ||
        message === 'Operación de sorteo inválida.'
    ) {
        return res.status(400).json({ success: false, message });
    }

    if (message === 'Sorteo no encontrado.') {
        return res.status(404).json({ success: false, message });
    }

    if (message === 'Transición de estado no permitida.') {
        return res.status(409).json({ success: false, message });
    }

    console.error('[Raffle Lab] Error administrativo:', error);

    return res.status(500).json({
        success: false,
        message: 'No se pudo completar la operación.',
    });
}

function serialize(draw) {
    return {
        id: draw.id,
        name: draw.name,
        totalNumbers: draw.total_numbers,
        status: draw.status,
    };
}

export async function createAdminDraw(req, res) {
    try {
        const draw = await createAdminRaffleDraw(req.body ?? {});

        return res.status(201).json({
            success: true,
            data: serialize(draw),
        });
    } catch (error) {
        return sendError(res, error);
    }
}

async function changeStatus(req, res, action) {
    try {
        const drawId = Number(req.params.drawId);

        if (
            !/^[1-9]\d*$/.test(req.params.drawId) ||
            !Number.isSafeInteger(drawId) ||
            drawId > 4294967295
        ) {
            return res.status(400).json({
                success: false,
                message: 'Identificador de sorteo inválido.',
            });
        }

        const draw = await changeAdminRaffleDrawStatus({
            drawId,
            action,
        });

        return res.status(200).json({
            success: true,
            data: serialize(draw),
        });
    } catch (error) {
        return sendError(res, error);
    }
}

export async function publishAdminDraw(req, res) {
    return changeStatus(req, res, 'publish');
}

export async function closeAdminDraw(req, res) {
    return changeStatus(req, res, 'close');
}
