import { Op } from 'sequelize';

import {
    RaffleDraw,
    RafflePrize,
    RaffleResult,
    RaffleNumber,
} from '../models/raffle-associations.js';

function validateDrawId(drawId) {
    if (
        !Number.isSafeInteger(drawId) ||
        drawId < 1 ||
        drawId > 4294967295
    ) {
        throw new Error('Identificador de sorteo inválido.');
    }
}

async function getResults({ drawId, publicOnly }) {
    validateDrawId(drawId);

    const where = publicOnly
        ? {
            id: drawId,
            status: 'closed',
            results_published_at: { [Op.ne]: null },
        }
        : { id: drawId };

    const draw = await RaffleDraw.findOne({
        where,
        attributes: ['id', 'results_published_at'],
    });

    if (!draw) {
        throw new Error('Sorteo no encontrado.');
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
        include: [{
            model: RaffleResult,
            as: 'result',
            required: false,
            attributes: ['id', 'number_id'],
            include: [{
                model: RaffleNumber,
                as: 'number',
                required: false,
                attributes: ['value'],
            }],
        }],
        order: [
            ['position', 'ASC'],
            ['id', 'ASC'],
        ],
    });

    return {
        drawId: draw.id,
        resultsPublishedAt: draw.results_published_at,
        prizes: prizes.map(prize => ({
            id: prize.id,
            position: prize.position,
            title: prize.title,
            description: prize.description,
            imagePath: prize.image_path,
            result: prize.result
                ? {
                    id: prize.result.id,
                    numberValue: prize.result.number?.value ?? null,
                }
                : null,
        })),
    };
}

export async function listAdminRaffleResults({ drawId }) {
    return getResults({ drawId, publicOnly: false });
}

export async function listPublicRaffleResults({ drawId }) {
    return getResults({ drawId, publicOnly: true });
}
