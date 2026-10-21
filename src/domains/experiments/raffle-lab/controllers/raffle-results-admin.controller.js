import {
    listAdminRaffleResults as readAdminResults,
} from '../services/raffle-results-read.service.js';

import {
    createAdminRaffleResult as createResult,
    updateAdminRaffleResult as updateResult,
    publishAdminRaffleResults as publishResults,
} from '../services/raffle-results-admin.service.js';

function parseId(value) {
    if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) {
        return null;
    }

    const id = Number(value);

    return Number.isSafeInteger(id) && id <= 4294967295
        ? id
        : null;
}

function parseNumberValue(value) {
    return Number.isSafeInteger(value) &&
        value >= 0 &&
        value <= 4294967295
        ? value
        : null;
}

function sendResultError(res, error) {
    const message = error.message;

    if ([
        'Datos de resultado inválidos.',
        'Identificador de sorteo inválido.',
    ].includes(message)) {
        return res.status(400).json({ success: false, message });
    }

    if ([
        'Sorteo no encontrado.',
        'Premio no encontrado.',
        'Resultado no encontrado.',
        'Número confirmado no encontrado.',
    ].includes(message)) {
        return res.status(404).json({ success: false, message });
    }

    if ([
        'El sorteo debe estar cerrado.',
        'Los resultados ya están publicados.',
        'El número no tiene una reserva confirmada en este sorteo.',
        'El premio ya tiene un resultado registrado.',
        'El número ya tiene un premio asignado.',
        'El premio o número ya tiene un resultado registrado.',
        'El sorteo no tiene premios.',
        'Todos los premios deben tener un ganador válido.',
        'Existe un número ganador no confirmado.',
        'Existe un ganador sin reserva confirmada.',
    ].includes(message)) {
        return res.status(409).json({ success: false, message });
    }

    console.error('[Raffle Lab] Error administrativo de resultados:', error);

    return res.status(500).json({
        success: false,
        message: 'No se pudo completar la operación de resultados.',
    });
}

export async function createAdminRaffleResult(req, res) {
    return executeCreateAdminRaffleResult(req, res, createResult);
}

export async function executeCreateAdminRaffleResult(req, res, createResultService) {
    const drawId = parseId(req.params.drawId);
    const prizeId = parseNumberValue(req.body?.prizeId);
    const numberValue = parseNumberValue(req.body?.numberValue);

    if (drawId === null || prizeId === null || prizeId < 1 ||
        numberValue === null) {
        return res.status(400).json({
            success: false,
            message: 'Datos de resultado inválidos.',
        });
    }

    try {
        const result = await createResultService({ drawId, prizeId, numberValue });

        return res.status(201).json({
            success: true,
            data: {
                id: result.id,
                drawId: result.draw_id,
                prizeId: result.prize_id,
                numberId: result.number_id,
            },
        });
    } catch (error) {
        return sendResultError(res, error);
    }
}

export async function updateAdminRaffleResult(req, res) {
    return executeUpdateAdminRaffleResult(req, res, updateResult);
}

export async function executeUpdateAdminRaffleResult(req, res, updateResultService) {
    const drawId = parseId(req.params.drawId);
    const prizeId = parseId(req.params.prizeId);
    const numberValue = parseNumberValue(req.body?.numberValue);

    if (drawId === null || prizeId === null || numberValue === null) {
        return res.status(400).json({
            success: false,
            message: 'Datos de resultado inválidos.',
        });
    }

    try {
        const result = await updateResultService({ drawId, prizeId, numberValue });

        return res.status(200).json({
            success: true,
            data: {
                id: result.id,
                drawId: result.draw_id,
                prizeId: result.prize_id,
                numberId: result.number_id,
            },
        });
    } catch (error) {
        return sendResultError(res, error);
    }
}

export async function publishAdminRaffleResults(req, res) {
    return executePublishAdminRaffleResults(req, res, publishResults);
}

export async function executePublishAdminRaffleResults(req, res, publishResultsService) {
    const drawId = parseId(req.params.drawId);

    if (drawId === null) {
        return res.status(400).json({
            success: false,
            message: 'Identificador de sorteo inválido.',
        });
    }

    try {
        const draw = await publishResultsService({ drawId });

        return res.status(200).json({
            success: true,
            data: {
                drawId: draw.id,
                resultsPublishedAt: draw.results_published_at,
            },
        });
    } catch (error) {
        return sendResultError(res, error);
    }
}

export async function listAdminRaffleResults(req, res) {
    const drawId = parseId(req.params.drawId);

    if (drawId === null) {
        return res.status(400).json({
            success: false,
            message: 'Identificador de sorteo inválido.',
        });
    }

    try {
        const data = await readAdminResults({ drawId });

        return res.status(200).json({
            success: true,
            data,
        });
    } catch (error) {
        return sendResultError(res, error);
    }
}
