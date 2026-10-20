import { Op } from 'sequelize';

import {
    RaffleDraw,
    RafflePrize,
} from '../models/raffle-associations.js';

export async function listPublicRafflePrizes(req, res) {
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

        const prizes = await RafflePrize.findAll({
            where: { draw_id: drawId },
            attributes: [
                'id',
                'position',
                'title',
                'description',
                'image_path',
            ],
            order: [
                ['position', 'ASC'],
                ['id', 'ASC'],
            ],
        });

        return res.status(200).json({
            success: true,
            data: {
                drawId,
                prizes: prizes.map(prize => ({
                    id: prize.id,
                    position: prize.position,
                    title: prize.title,
                    description: prize.description,
                    imagePath: prize.image_path,
                })),
            },
        });
    } catch (error) {
        console.error(
            '[Raffle Lab] Error consultando premios públicos:',
            error
        );

        return res.status(500).json({
            success: false,
            message: 'No se pudieron consultar los premios.',
        });
    }
}
