import { unlink } from 'node:fs/promises';
import path from 'node:path';

import { RaffleDraw } from '../models/raffle-draw.model.js';
import { storeRaffleBanner } from './raffle-banner-storage.service.js';

export async function updateAdminRaffleBanner({
    drawId,
    file,
    variant = 'desktop',
}) {
    if (
        !Number.isSafeInteger(drawId) ||
        drawId < 1 ||
        drawId > 4294967295
    ) {
        throw new Error('Identificador de sorteo inválido.');
    }

    if (!file?.buffer?.length) {
        throw new Error('Imagen del banner obligatoria.');
    }

    const bannerFields = {
        desktop: 'banner_image',
        mobile: 'banner_image_mobile',
    };

    if (!Object.hasOwn(bannerFields, variant)) {
        throw new Error('Variante de banner inválida.');
    }

    const draw = await RaffleDraw.findByPk(drawId);

    if (!draw) {
        throw new Error('Sorteo no encontrado.');
    }

    const bannerImage = await storeRaffleBanner({ drawId, file });

    try {
        await draw.update({
            [bannerFields[variant]]: bannerImage,
        });
    } catch (error) {
        const filename = path.basename(bannerImage);
        const filePath = path.resolve(
            'public',
            'uploads',
            'raffle-lab',
            'draws',
            String(drawId),
            filename
        );

        try {
            await unlink(filePath);
        } catch (cleanupError) {
            console.error(
                'No se pudo limpiar el banner tras fallar MySQL:',
                cleanupError
            );
        }

        throw error;
    }

    return draw;
}


export async function removeAdminRaffleBanner({
    drawId,
    variant,
}) {
    if (
        !Number.isSafeInteger(drawId) ||
        drawId < 1 ||
        drawId > 4294967295
    ) {
        throw new Error('Identificador de sorteo inválido.');
    }

    const bannerFields = {
        desktop: 'banner_image',
        mobile: 'banner_image_mobile',
    };

    if (!Object.hasOwn(bannerFields, variant)) {
        throw new Error('Variante de banner inválida.');
    }

    const draw = await RaffleDraw.findByPk(drawId);

    if (!draw) {
        throw new Error('Sorteo no encontrado.');
    }

    const field = bannerFields[variant];

    if (draw[field] !== null) {
        await draw.update({
            [field]: null,
        });
    }

    return draw;
}
