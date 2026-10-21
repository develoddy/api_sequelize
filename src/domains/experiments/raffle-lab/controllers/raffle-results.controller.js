import {
    listPublicRaffleResults as readPublicResults,
} from '../services/raffle-results-read.service.js';

export async function listPublicRaffleResults(req, res) {
    const rawDrawId = req.params.drawId;
    const drawId = Number(rawDrawId);

    if (
        typeof rawDrawId !== 'string' ||
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
        const data = await readPublicResults({ drawId });

        return res.status(200).json({
            success: true,
            data,
        });
    } catch (error) {
        if (error.message === 'Sorteo no encontrado.') {
            return res.status(404).json({
                success: false,
                message: error.message,
            });
        }

        console.error(
            '[Raffle Lab] Error consultando resultados públicos:',
            error
        );

        return res.status(500).json({
            success: false,
            message: 'No se pudieron consultar los resultados.',
        });
    }
}
