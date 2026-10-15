import { experimentsSequelize } from '../../../../database/experiments.database.js';
import {
    RaffleDraw,
    RaffleNumber,
} from '../models/raffle-associations.js';

const MAX_NUMBERS = 10000;

export async function createAdminRaffleDraw({ name, totalNumbers }) {
    const cleanName = typeof name === 'string' ? name.trim() : '';

    if (
        !cleanName ||
        cleanName.length > 150 ||
        !Number.isSafeInteger(totalNumbers) ||
        totalNumbers < 1 ||
        totalNumbers > MAX_NUMBERS
    ) {
        throw new Error('Datos de sorteo inválidos.');
    }

    return experimentsSequelize.transaction(async transaction => {
        const draw = await RaffleDraw.create({
            name: cleanName,
            total_numbers: totalNumbers,
            status: 'draft',
        }, { transaction });

        const batchSize = 500;

        for (let start = 1; start <= totalNumbers; start += batchSize) {
            const end = Math.min(start + batchSize - 1, totalNumbers);
            const numbers = [];

            for (let value = start; value <= end; value++) {
                numbers.push({
                    draw_id: draw.id,
                    value,
                    status: 'available',
                });
            }

            await RaffleNumber.bulkCreate(numbers, { transaction });
        }

        return draw;
    });
}

export async function changeAdminRaffleDrawStatus({ drawId, action }) {
    if (
        !Number.isSafeInteger(drawId) ||
        drawId < 1 ||
        drawId > 4294967295
    ) {
        throw new Error('Identificador de sorteo inválido.');
    }

    const transitions = {
        publish: { from: 'draft', to: 'published' },
        close: { from: 'published', to: 'closed' },
    };

    const transition = transitions[action];

    if (!transition) {
        throw new Error('Operación de sorteo inválida.');
    }

    return experimentsSequelize.transaction(async transaction => {
        const draw = await RaffleDraw.findByPk(drawId, {
            transaction,
            lock: transaction.LOCK.UPDATE,
        });

        if (!draw) {
            throw new Error('Sorteo no encontrado.');
        }

        if (draw.status !== transition.from) {
            throw new Error('Transición de estado no permitida.');
        }

        await draw.update(
            { status: transition.to },
            { transaction }
        );

        return draw;
    });
}
