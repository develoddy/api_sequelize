import {
    createAdminRafflePrize as createPrize,
    updateAdminRafflePrize as updatePrize,
    deleteAdminRafflePrize as deletePrize,
} from '../services/raffle-prizes-admin.service.js';

import multer from 'multer';
import {
    updateAdminRafflePrizeImage as updatePrizeImage,
    removeAdminRafflePrizeImage as removePrizeImage,
} from '../services/raffle-prizes-admin.service.js';

import {
    RaffleDraw,
    RafflePrize,
} from '../models/raffle-associations.js';

function isRafflePrizeConflict(message) {
    return [
        'No se pueden modificar premios con resultados publicados.',
        'No se puede eliminar un premio con un resultado registrado.',
    ].includes(message);
}

export async function listAdminRafflePrizes(req, res) {
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
        const draw = await RaffleDraw.findByPk(drawId, {
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
            '[Raffle Lab] Error consultando premios administrativos:',
            error
        );

        return res.status(500).json({
            success: false,
            message: 'No se pudieron consultar los premios.',
        });
    }
}

export async function createAdminRafflePrize(req, res) {
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
        const prize = await createPrize({
            drawId,
            prize: req.body,
        });

        return res.status(201).json({
            success: true,
            data: {
                id: prize.id,
                drawId: prize.draw_id,
                position: prize.position,
                title: prize.title,
                description: prize.description,
                imagePath: prize.image_path,
            },
        });
    } catch (error) {
        const message = error.message;

        if (
            message === 'Identificador de sorteo inválido.' ||
            message === 'Datos de premio inválidos.'
        ) {
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

        if (message === 'Ya existe un premio en esa posición.') {
            return res.status(409).json({
                success: false,
                message,
            });
        }

        if (isRafflePrizeConflict(message)) {
            return res.status(409).json({
                success: false,
                message,
            });
        }

        console.error(
            '[Raffle Lab] Error creando premio administrativo:',
            error
        );

        return res.status(500).json({
            success: false,
            message: 'No se pudo crear el premio.',
        });
    }
}

export async function updateAdminRafflePrize(req, res) {
    const rawDrawId = req.params.drawId;
    const rawPrizeId = req.params.prizeId;

    const drawId = Number(rawDrawId);
    const prizeId = Number(rawPrizeId);

    if (
        !/^[1-9]\d*$/.test(rawDrawId) ||
        !/^[1-9]\d*$/.test(rawPrizeId) ||
        !Number.isSafeInteger(drawId) ||
        !Number.isSafeInteger(prizeId) ||
        drawId > 4294967295 ||
        prizeId > 4294967295
    ) {
        return res.status(400).json({
            success: false,
            message: 'Identificador inválido.',
        });
    }

    try {
        const prize = await updatePrize({
            drawId,
            prizeId,
            changes: req.body,
        });

        return res.status(200).json({
            success: true,
            data: {
                id: prize.id,
                drawId: prize.draw_id,
                position: prize.position,
                title: prize.title,
                description: prize.description,
                imagePath: prize.image_path,
            },
        });
    } catch (error) {
        const message = error.message;

        if (
            message === 'Identificador inválido.' ||
            message === 'Datos de premio inválidos.'
        ) {
            return res.status(400).json({
                success: false,
                message,
            });
        }

        if (message === 'Premio no encontrado.') {
            return res.status(404).json({
                success: false,
                message,
            });
        }

        if (message === 'Ya existe un premio en esa posición.') {
            return res.status(409).json({
                success: false,
                message,
            });
        }

        if (isRafflePrizeConflict(message)) {
            return res.status(409).json({
                success: false,
                message,
            });
        }

        console.error(
            '[Raffle Lab] Error actualizando premio administrativo:',
            error
        );

        return res.status(500).json({
            success: false,
            message: 'No se pudo actualizar el premio.',
        });
    }
}

export async function deleteAdminRafflePrize(req, res) {
    const rawDrawId = req.params.drawId;
    const rawPrizeId = req.params.prizeId;

    const drawId = Number(rawDrawId);
    const prizeId = Number(rawPrizeId);

    if (
        !/^[1-9]\d*$/.test(rawDrawId) ||
        !/^[1-9]\d*$/.test(rawPrizeId) ||
        !Number.isSafeInteger(drawId) ||
        !Number.isSafeInteger(prizeId) ||
        drawId > 4294967295 ||
        prizeId > 4294967295
    ) {
        return res.status(400).json({
            success: false,
            message: 'Identificador inválido.',
        });
    }

    try {
        const result = await deletePrize({
            drawId,
            prizeId,
        });

        return res.status(200).json({
            success: true,
            data: result,
        });
    } catch (error) {
        const message = error.message;

        if (message === 'Identificador inválido.') {
            return res.status(400).json({
                success: false,
                message,
            });
        }

        if (message === 'Premio no encontrado.') {
            return res.status(404).json({
                success: false,
                message,
            });
        }

        if (isRafflePrizeConflict(message)) {
            return res.status(409).json({
                success: false,
                message,
            });
        }

        console.error(
            '[Raffle Lab] Error eliminando premio administrativo:',
            error
        );

        return res.status(500).json({
            success: false,
            message: 'No se pudo eliminar el premio.',
        });
    }
}

function sendPrizeImageError(res, error) {
    if (error instanceof multer.MulterError) {
        return res.status(400).json({
            success: false,
            message: error.code === 'LIMIT_FILE_SIZE'
                ? 'La imagen no puede superar los 5 MB.'
                : 'Archivo de imagen inválido.',
        });
    }

    const message = error.message;

    if ([
        'Identificador inválido.',
        'Imagen del premio obligatoria.',
        'Imagen del premio inválida.',
        'Formato de imagen no permitido.',
    ].includes(message)) {
        return res.status(400).json({
            success: false,
            message,
        });
    }

    if (message === 'Premio no encontrado.') {
        return res.status(404).json({
            success: false,
            message,
        });
    }

    if (isRafflePrizeConflict(message)) {
        return res.status(409).json({
            success: false,
            message,
        });
    }

    console.error(
        '[Raffle Lab] Error al actualizar imagen de premio:',
        error
    );

    return res.status(500).json({
        success: false,
        message: 'No se pudo actualizar la imagen del premio.',
    });
}

export function handleRafflePrizeImageUpload(req, res, next) {
    const rawDrawId = req.params.drawId;
    const rawPrizeId = req.params.prizeId;

    const drawId = Number(rawDrawId);
    const prizeId = Number(rawPrizeId);

    if (
        !/^[1-9]\d*$/.test(rawDrawId) ||
        !/^[1-9]\d*$/.test(rawPrizeId) ||
        !Number.isSafeInteger(drawId) ||
        !Number.isSafeInteger(prizeId) ||
        drawId > 4294967295 ||
        prizeId > 4294967295
    ) {
        return res.status(400).json({
            success: false,
            message: 'Identificador inválido.',
        });
    }

    return next();
}

export async function uploadAdminRafflePrizeImage(req, res) {
    try {
        const prize = await updatePrizeImage({
            drawId: Number(req.params.drawId),
            prizeId: Number(req.params.prizeId),
            file: req.file,
        });

        return res.status(200).json({
            success: true,
            data: {
                id: prize.id,
                drawId: prize.draw_id,
                position: prize.position,
                title: prize.title,
                description: prize.description,
                imagePath: prize.image_path,
            },
        });
    } catch (error) {
        return sendPrizeImageError(res, error);
    }
}

export function handleRafflePrizeImageUploadError(
    error,
    req,
    res,
    next
) {
    if (!error) {
        return next();
    }

    return sendPrizeImageError(res, error);
}

export async function removeAdminRafflePrizeImage(req, res) {
    const rawDrawId = req.params.drawId;
    const rawPrizeId = req.params.prizeId;

    const drawId = Number(rawDrawId);
    const prizeId = Number(rawPrizeId);

    if (
        !/^[1-9]\d*$/.test(rawDrawId) ||
        !/^[1-9]\d*$/.test(rawPrizeId) ||
        !Number.isSafeInteger(drawId) ||
        !Number.isSafeInteger(prizeId) ||
        drawId > 4294967295 ||
        prizeId > 4294967295
    ) {
        return res.status(400).json({
            success: false,
            message: 'Identificador inválido.',
        });
    }

    try {
        const prize = await removePrizeImage({
            drawId,
            prizeId,
        });

        return res.status(200).json({
            success: true,
            data: {
                id: prize.id,
                drawId: prize.draw_id,
                position: prize.position,
                title: prize.title,
                description: prize.description,
                imagePath: prize.image_path,
            },
        });
    } catch (error) {
        return sendPrizeImageError(res, error);
    }
}
