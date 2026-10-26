import { experimentsSequelize } from '../../../../database/experiments.database.js';
import {
    RaffleDraw,
    RaffleNumber,
    RaffleReservation,
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

        if (action === 'close') {
            const activeReservation = await RaffleReservation.findOne({
                where: {
                    draw_id: drawId,
                    status: 'active',
                },
                attributes: ['id'],
                transaction,
            });

            if (activeReservation) {
                throw new Error(
                    'El sorteo tiene reservas activas pendientes de resolver.'
                );
            }
        }

        await draw.update(
            { status: transition.to },
            { transaction }
        );

        return draw;
    });
}

export async function updateAdminRaffleDrawPresentation({ drawId, presentation }) {
    if (
        !Number.isSafeInteger(drawId) ||
        drawId < 1 ||
        drawId > 4294967295
    ) {
        throw new Error('Identificador de sorteo inválido.');
    }

    if (
        !presentation ||
        typeof presentation !== 'object' ||
        Array.isArray(presentation)
    ) {
        throw new Error('Datos de presentación inválidos.');
    }

    const allowedFields = ['headline', 'description', 'ticketPrice', 'drawDate'];
    const providedFields = Object.keys(presentation);

    if (
        providedFields.length === 0 ||
        providedFields.some(field => !allowedFields.includes(field))
    ) {
        throw new Error('Datos de presentación inválidos.');
    }

    const changes = {};

    for (const field of ['headline', 'description']) {
        if (!Object.hasOwn(presentation, field)) continue;

        const value = presentation[field];
        const maxLength = field === 'headline' ? 200 : 5000;

        if (value !== null && typeof value !== 'string') {
            throw new Error('Datos de presentación inválidos.');
        }

        const cleaned = value === null ? null : value.trim();

        if (cleaned !== null && cleaned.length > maxLength) {
            throw new Error('Datos de presentación inválidos.');
        }

        changes[field] = cleaned;
    }

    if (Object.hasOwn(presentation, 'ticketPrice')) {
        const value = presentation.ticketPrice;

        if (
            value !== null &&
            (
                typeof value !== 'number' ||
                !Number.isFinite(value) ||
                value < 0 ||
                value > 99999999.99 ||
                !Number.isInteger(Math.round(value * 100) * 1)
            )
        ) {
            throw new Error('Datos de presentación inválidos.');
        }

        if (value !== null && Math.abs(value * 100 - Math.round(value * 100)) > 1e-7) {
            throw new Error('Datos de presentación inválidos.');
        }

        changes.ticket_price = value;
    }

    if (Object.hasOwn(presentation, 'drawDate')) {
        const value = presentation.drawDate;

        if (
            value !== null &&
            (
                typeof value !== 'string' ||
                !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) ||
                !Number.isFinite(Date.parse(value)) ||
                new Date(value).toISOString() !==
                    new Date(Date.parse(value)).toISOString()
            )
        ) {
            throw new Error('Datos de presentación inválidos.');
        }

        changes.draw_date = value === null ? null : new Date(value);
    }

    return experimentsSequelize.transaction(async transaction => {
        const draw = await RaffleDraw.findByPk(drawId, {
            transaction,
            lock: transaction.LOCK.UPDATE,
        });

        if (!draw) {
            throw new Error('Sorteo no encontrado.');
        }

        await draw.update(changes, { transaction });

        return draw;
    });
}
