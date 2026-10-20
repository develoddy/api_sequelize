import multer from 'multer';

import { updateAdminRaffleBanner, removeAdminRaffleBanner } from '../services/raffle-banner-admin.service.js';

function sendBannerError(res, error) {
    const message = error.message;

    if (error instanceof multer.MulterError) {
        return res.status(400).json({
            success: false,
            message: error.code === 'LIMIT_FILE_SIZE'
                ? 'La imagen no puede superar los 5 MB.'
                : 'Archivo de imagen inválido.',
        });
    }

    const badRequestMessages = [
        'Identificador de sorteo inválido.',
        'Imagen del banner obligatoria.',
        'Imagen del banner inválida.',
        'Formato de imagen no permitido.',
        'Variante de banner inválida.',
    ];

    if (badRequestMessages.includes(message)) {
        return res.status(400).json({
            success: false,
            message,
        });
    }

    if (message === 'Sorteo no encontrado.') {
        return res.status(404).json({
            success: false,
            message,
        });
    }

    console.error('Error al actualizar el banner:', error);

    return res.status(500).json({
        success: false,
        message: 'Error interno al actualizar el banner.',
    });
}

export function handleRaffleBannerUpload(req, res, next) {
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

    return next();
}

export async function uploadAdminDrawBanner(req, res) {
    try {
        const drawId = Number(req.params.drawId);

        const draw = await updateAdminRaffleBanner({
            drawId,
            file: req.file,
            variant: req.body?.variant ?? 'desktop',
        });

        return res.status(200).json({
            success: true,
            data: {
                id: draw.id,
                bannerImage: draw.banner_image,
                bannerImageMobile: draw.banner_image_mobile,
            },
        });
    } catch (error) {
        return sendBannerError(res, error);
    }
}

export function handleRaffleBannerUploadError(error, req, res, next) {
    if (!error) {
        return next();
    }

    return sendBannerError(res, error);
}


export async function removeAdminDrawBanner(req, res) {
    try {
        const drawId = Number(req.params.drawId);

        const draw = await removeAdminRaffleBanner({
            drawId,
            variant: req.params.variant,
        });

        return res.status(200).json({
            success: true,
            data: {
                id: draw.id,
                bannerImage: draw.banner_image,
                bannerImageMobile: draw.banner_image_mobile,
            },
        });
    } catch (error) {
        return sendBannerError(res, error);
    }
}
