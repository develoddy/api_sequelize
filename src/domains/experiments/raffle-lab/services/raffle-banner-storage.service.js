import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const MAX_IMAGE_PIXELS = 25_000_000;

export async function storeRaffleBanner({ drawId, file }) {
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

    let imageBuffer;

    try {
        const image = sharp(file.buffer, {
            limitInputPixels: MAX_IMAGE_PIXELS,
            failOn: 'error',
        });

        const metadata = await image.metadata();

        if (!['jpeg', 'png', 'webp'].includes(metadata.format)) {
            throw new Error('Formato no permitido.');
        }

        imageBuffer = await image
            .rotate()
            .resize({
                width: 1920,
                height: 1080,
                fit: 'inside',
                withoutEnlargement: true,
            })
            .webp({ quality: 85 })
            .toBuffer();
    } catch {
        throw new Error('Imagen del banner inválida.');
    }

    const directory = path.resolve(
        'public',
        'uploads',
        'raffle-lab',
        'draws',
        String(drawId)
    );

    await mkdir(directory, { recursive: true });

    const filename = `${randomUUID()}.webp`;

    await writeFile(
        path.join(directory, filename),
        imageBuffer,
        { flag: 'wx' }
    );

    return `/uploads/raffle-lab/draws/${drawId}/${filename}`;
}
