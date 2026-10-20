import { unlink } from 'node:fs/promises';
import path from 'node:path';

import { RafflePrize } from '../models/raffle-prize.model.js';

export async function cleanupUnusedRafflePrizeImage({
    drawId,
    imagePath,
}) {
    if (
        !Number.isSafeInteger(drawId) ||
        drawId < 1 ||
        drawId > 4294967295
    ) {
        throw new Error('Identificador de sorteo inválido.');
    }

    if (typeof imagePath !== 'string') {
        throw new Error('Ruta de imagen inválida.');
    }

    const prefix = `/uploads/raffle-lab/draws/${drawId}/prizes/`;
    const filename = imagePath.slice(prefix.length);

    if (
        !imagePath.startsWith(prefix) ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$/i.test(filename)
    ) {
        throw new Error('Ruta de imagen inválida.');
    }

    const directory = path.resolve(
        'public',
        'uploads',
        'raffle-lab',
        'draws',
        String(drawId),
        'prizes'
    );

    const filePath = path.join(directory, filename);

    const references = await RafflePrize.count({
        where: {
            image_path: imagePath,
        },
    });

    if (references > 0) {
        return {
            deleted: false,
            reason: 'still_referenced',
        };
    }

    try {
        await unlink(filePath);

        return {
            deleted: true,
        };
    } catch (error) {
        if (error.code === 'ENOENT') {
            return {
                deleted: false,
                reason: 'already_missing',
            };
        }

        throw error;
    }
}
