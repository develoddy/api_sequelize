import { unlink } from 'node:fs/promises';
import path from 'node:path';
import { UniqueConstraintError } from 'sequelize';

import { experimentsSequelize } from '../../../../database/experiments.database.js';

import { storeRafflePrizeImage } from './raffle-prize-storage.service.js';
import { cleanupUnusedRafflePrizeImage } from './raffle-prize-cleanup.service.js';

import {
    RaffleDraw,
    RafflePrize,
    RaffleResult,
} from '../models/raffle-associations.js';

async function lockEditableRaffleDraw({ drawId, transaction }) {
    const draw = await RaffleDraw.findByPk(drawId, {
        attributes: ['id', 'results_published_at'],
        transaction,
        lock: transaction.LOCK.UPDATE,
    });

    if (!draw) {
        throw new Error('Sorteo no encontrado.');
    }

    if (draw.results_published_at !== null) {
        throw new Error('No se pueden modificar premios con resultados publicados.');
    }

    return draw;
}

export async function createAdminRafflePrize({ drawId, prize }) {
    if (
        !Number.isSafeInteger(drawId) ||
        drawId < 1 ||
        drawId > 4294967295
    ) {
        throw new Error('Identificador de sorteo inválido.');
    }

    if (
        !prize ||
        typeof prize !== 'object' ||
        Array.isArray(prize)
    ) {
        throw new Error('Datos de premio inválidos.');
    }

    const allowedFields = ['position', 'title', 'description'];
    const providedFields = Object.keys(prize);

    if (providedFields.some(field => !allowedFields.includes(field))) {
        throw new Error('Datos de premio inválidos.');
    }

    const position = prize.position;
    const title = typeof prize.title === 'string'
        ? prize.title.trim()
        : '';

    const description = prize.description === undefined ||
        prize.description === null
        ? null
        : typeof prize.description === 'string'
            ? prize.description.trim() || null
            : undefined;

    if (
        !Number.isSafeInteger(position) ||
        position < 1 ||
        position > 4294967295 ||
        !title ||
        title.length > 200 ||
        description === undefined
    ) {
        throw new Error('Datos de premio inválidos.');
    }

    try {
        return await experimentsSequelize.transaction(async transaction => {
            await lockEditableRaffleDraw({
                drawId,
                transaction,
            });

            return RafflePrize.create({
                draw_id: drawId,
                position,
                title,
                description,
                image_path: null,
            }, { transaction });
        });
    } catch (error) {
        if (error instanceof UniqueConstraintError) {
            throw new Error('Ya existe un premio en esa posición.');
        }

        throw error;
    }
}

export async function updateAdminRafflePrize({
    drawId,
    prizeId,
    changes,
}) {
    if (
        !Number.isSafeInteger(drawId) ||
        drawId < 1 ||
        drawId > 4294967295 ||
        !Number.isSafeInteger(prizeId) ||
        prizeId < 1 ||
        prizeId > 4294967295
    ) {
        throw new Error('Identificador inválido.');
    }

    if (
        !changes ||
        typeof changes !== 'object' ||
        Array.isArray(changes)
    ) {
        throw new Error('Datos de premio inválidos.');
    }

    const allowedFields = ['position', 'title', 'description'];
    const fields = Object.keys(changes);

    if (
        fields.length === 0 ||
        fields.some(field => !allowedFields.includes(field))
    ) {
        throw new Error('Datos de premio inválidos.');
    }

    const updates = {};

    if ('position' in changes) {
        if (
            !Number.isSafeInteger(changes.position) ||
            changes.position < 1 ||
            changes.position > 4294967295
        ) {
            throw new Error('Datos de premio inválidos.');
        }

        updates.position = changes.position;
    }

    if ('title' in changes) {
        const title = typeof changes.title === 'string'
            ? changes.title.trim()
            : '';

        if (!title || title.length > 200) {
            throw new Error('Datos de premio inválidos.');
        }

        updates.title = title;
    }

    if ('description' in changes) {
        if (
            changes.description !== null &&
            typeof changes.description !== 'string'
        ) {
            throw new Error('Datos de premio inválidos.');
        }

        updates.description = typeof changes.description === 'string'
            ? changes.description.trim() || null
            : null;
    }

    try {
        return await experimentsSequelize.transaction(async transaction => {
            await lockEditableRaffleDraw({
                drawId,
                transaction,
            });

            const prize = await RafflePrize.findOne({
                where: {
                    id: prizeId,
                    draw_id: drawId,
                },
                transaction,
                lock: transaction.LOCK.UPDATE,
            });

            if (!prize) {
                throw new Error('Premio no encontrado.');
            }

            await prize.update(updates, { transaction });

            return prize;
        });
    } catch (error) {
        if (error instanceof UniqueConstraintError) {
            throw new Error('Ya existe un premio en esa posición.');
        }

        throw error;
    }
}

export async function deleteAdminRafflePrize({
    drawId,
    prizeId,
}) {
    if (
        !Number.isSafeInteger(drawId) ||
        drawId < 1 ||
        drawId > 4294967295 ||
        !Number.isSafeInteger(prizeId) ||
        prizeId < 1 ||
        prizeId > 4294967295
    ) {
        throw new Error('Identificador inválido.');
    }

    let previousImagePath = null;

    const result = await experimentsSequelize.transaction(async transaction => {
        await lockEditableRaffleDraw({
            drawId,
            transaction,
        });

        const prize = await RafflePrize.findOne({
            where: {
                id: prizeId,
                draw_id: drawId,
            },
            transaction,
            lock: transaction.LOCK.UPDATE,
        });

        if (!prize) {
            throw new Error('Premio no encontrado.');
        }

        previousImagePath = prize.image_path;

        const existingResult = await RaffleResult.findOne({
            where: { prize_id: prizeId },
            attributes: ['id'],
            transaction,
        });

        if (existingResult) {
            throw new Error('No se puede eliminar un premio con un resultado registrado.');
        }

        await prize.destroy({ transaction });

        return {
            id: prizeId,
            drawId,
        };
    });

    if (previousImagePath) {
        try {
            await cleanupUnusedRafflePrizeImage({
                drawId,
                imagePath: previousImagePath,
            });
        } catch (cleanupError) {
            console.error(
                '[Raffle Lab] No se pudo limpiar la imagen del premio eliminado:',
                cleanupError
            );
        }
    }

    return result;
}

export async function updateAdminRafflePrizeImage({
    drawId,
    prizeId,
    file,
    storeImage = storeRafflePrizeImage,
    removeStoredImage = unlink,
}) {
    if (
        !Number.isSafeInteger(drawId) ||
        drawId < 1 ||
        drawId > 4294967295 ||
        !Number.isSafeInteger(prizeId) ||
        prizeId < 1 ||
        prizeId > 4294967295
    ) {
        throw new Error('Identificador inválido.');
    }

    if (!file?.buffer?.length) {
        throw new Error('Imagen del premio obligatoria.');
    }

    const existingPrize = await RafflePrize.findOne({
        where: {
            id: prizeId,
            draw_id: drawId,
        },
        attributes: ['id'],
    });

    if (!existingPrize) {
        throw new Error('Premio no encontrado.');
    }

    const imagePath = await storeImage({
        drawId,
        file,
    });

    let previousImagePath = null;
    let updatedPrize;

    try {
        updatedPrize = await experimentsSequelize.transaction(async transaction => {
            await lockEditableRaffleDraw({
                drawId,
                transaction,
            });

            const prize = await RafflePrize.findOne({
                where: {
                    id: prizeId,
                    draw_id: drawId,
                },
                transaction,
                lock: transaction.LOCK.UPDATE,
            });

            if (!prize) {
                throw new Error('Premio no encontrado.');
            }

            previousImagePath = prize.image_path;

            await prize.update({
                image_path: imagePath,
            }, { transaction });

            return prize;
        });
    } catch (error) {
        const filename = path.basename(imagePath);

        const filePath = path.resolve(
            'public',
            'uploads',
            'raffle-lab',
            'draws',
            String(drawId),
            'prizes',
            filename
        );

        try {
            await removeStoredImage(filePath);
        } catch (cleanupError) {
            console.error(
                'No se pudo limpiar la imagen del premio:',
                cleanupError
            );
        }

        throw error;
    }

    if (previousImagePath && previousImagePath !== imagePath) {
        try {
            await cleanupUnusedRafflePrizeImage({
                drawId,
                imagePath: previousImagePath,
            });
        } catch (cleanupError) {
            console.error(
                '[Raffle Lab] No se pudo limpiar la imagen anterior:',
                cleanupError
            );
        }
    }

    return updatedPrize;
}

export async function removeAdminRafflePrizeImage({
    drawId,
    prizeId,
}) {
    if (
        !Number.isSafeInteger(drawId) ||
        drawId < 1 ||
        drawId > 4294967295 ||
        !Number.isSafeInteger(prizeId) ||
        prizeId < 1 ||
        prizeId > 4294967295
    ) {
        throw new Error('Identificador inválido.');
    }

    let previousImagePath = null;

    const updatedPrize = await experimentsSequelize.transaction(async transaction => {
        await lockEditableRaffleDraw({
            drawId,
            transaction,
        });

        const prize = await RafflePrize.findOne({
            where: {
                id: prizeId,
                draw_id: drawId,
            },
            transaction,
            lock: transaction.LOCK.UPDATE,
        });

        if (!prize) {
            throw new Error('Premio no encontrado.');
        }

        previousImagePath = prize.image_path;

        if (previousImagePath !== null) {
            await prize.update({
                image_path: null,
            }, { transaction });
        }

        return prize;
    });

    if (previousImagePath) {
        try {
            await cleanupUnusedRafflePrizeImage({
                drawId,
                imagePath: previousImagePath,
            });
        } catch (cleanupError) {
            console.error(
                '[Raffle Lab] No se pudo limpiar la imagen retirada:',
                cleanupError
            );
        }
    }

    return updatedPrize;
}
