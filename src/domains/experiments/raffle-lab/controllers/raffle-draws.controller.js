import { Op } from 'sequelize';

import {
    RaffleDraw,
    RaffleNumber,
} from '../models/raffle-associations.js';

export async function listPublicRaffleDraws(req, res) {
    try {
        const draws = await RaffleDraw.findAll({
            where: {
                status: {
                    [Op.in]: ['published', 'closed'],
                },
            },
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
                'whatsapp_number',
            ],
            order: [['id', 'ASC']],
        });

        return res.status(200).json({
            success: true,
            data: draws.map(draw => ({
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
                whatsappNumber: draw.whatsapp_number,
            })),
        });
    } catch (error) {
        console.error(
            '[Raffle Lab] Error consultando sorteos públicos:',
            error
        );

        return res.status(500).json({
            success: false,
            message: 'No se pudieron consultar los sorteos.',
        });
    }
}

export async function listPublicRaffleNumbers(req, res) {
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

        const draw = await RaffleDraw.findOne({
            where: {
                id: drawId,
                status: {
                    [Op.in]: ['published', 'closed'],
                },
            },
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
                drawId: draw.id,
                numbers: numbers.map(number => ({
                    value: number.value,
                    status: number.status,
                })),
            },
        });
    } catch (error) {
        console.error(
            '[Raffle Lab] Error consultando números públicos:',
            error
        );

        return res.status(500).json({
            success: false,
            message: 'No se pudieron consultar los números.',
        });
    }
}
