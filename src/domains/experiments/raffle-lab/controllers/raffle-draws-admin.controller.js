import { RaffleDraw, RaffleNumber } from '../models/raffle-associations.js';

import {
    createAdminRaffleDraw,
    changeAdminRaffleDrawStatus,
    updateAdminRaffleDrawPresentation,
} from '../services/raffle-draws-admin.service.js';

function sendError(res, error) {
    const message = error.message;

    if (
        message === 'Datos de sorteo inválidos.' ||
        message === 'Identificador de sorteo inválido.' ||
        message === 'Operación de sorteo inválida.' ||
        message === 'Datos de presentación inválidos.'
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
        headline: draw.headline,
        description: draw.description,
        bannerImage: draw.banner_image,
        bannerImageMobile: draw.banner_image_mobile,
        ticketPrice: draw.ticket_price,
        drawDate: draw.draw_date,
    };
}

export async function listAdminDraws(req, res) {
    try {
        const draws = await RaffleDraw.findAll({
            attributes: [
                'id',
                'name',
                'total_numbers',
                'status',
                'headline',
                'description',
                'banner_image',
                'banner_image_mobile',
                'ticket_price',
                'draw_date',
            ],
            order: [['id', 'DESC']],
        });

        return res.status(200).json({
            success: true,
            data: draws.map(serialize),
        });
    } catch (error) {
        console.error('[Raffle Lab] Error consultando sorteos administrativos:', error);

        return res.status(500).json({
            success: false,
            message: 'No se pudieron consultar los sorteos.',
        });
    }
}

export async function listAdminDrawNumbers(req, res) {
    const rawDrawId = req.params.drawId;
    const drawId = Number(rawDrawId);

    if (
        !/^[1-9]\d*$/.test(rawDrawId) ||
        !Number.isSafeInteger(drawId) ||
        drawId > 4294967295
    ) {
        return res.status(400).json({
            success: false,
            message: 'Identificador de sorteo inválido.',
        });
    }

    try {
        const draw = await RaffleDraw.findByPk(drawId, {
            attributes: ['id'],
        });

        if (!draw) {
            return res.status(404).json({
                success: false,
                message: 'Sorteo no encontrado.',
            });
        }

        const numbers = await RaffleNumber.findAll({
            where: { draw_id: drawId },
            attributes: ['value', 'status'],
            order: [['value', 'ASC']],
        });

        return res.status(200).json({
            success: true,
            data: {
                drawId,
                numbers: numbers.map(number => ({
                    value: number.value,
                    status: number.status,
                })),
            },
        });
    } catch (error) {
        console.error('[Raffle Lab] Error consultando números administrativos:', error);

        return res.status(500).json({
            success: false,
            message: 'No se pudieron consultar los números.',
        });
    }
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

export async function updateAdminDrawPresentation(req, res) {
    try {
        const rawDrawId = req.params.drawId;
        const drawId = Number(rawDrawId);

        if (
            !/^[1-9]\d*$/.test(rawDrawId) ||
            !Number.isSafeInteger(drawId) ||
            drawId > 4294967295
        ) {
            return res.status(400).json({
                success: false,
                message: 'Identificador de sorteo inválido.',
            });
        }

        const draw = await updateAdminRaffleDrawPresentation({
            drawId,
            presentation: req.body,
        });

        return res.status(200).json({
            success: true,
            data: serialize(draw),
        });
    } catch (error) {
        return sendError(res, error);
    }
}
