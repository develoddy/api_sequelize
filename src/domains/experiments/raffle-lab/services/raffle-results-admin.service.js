import { UniqueConstraintError } from 'sequelize';

import { experimentsSequelize } from '../../../../database/experiments.database.js';

import {
    RaffleDraw,
    RafflePrize,
    RaffleNumber,
    RaffleReservation,
    RaffleResult,
} from '../models/raffle-associations.js';

function validateId(value) {
    return Number.isSafeInteger(value) &&
        value >= 1 &&
        value <= 4294967295;
}

function validateResultInput({ drawId, prizeId, numberValue }) {
    if (
        !validateId(drawId) ||
        !validateId(prizeId) ||
        !Number.isSafeInteger(numberValue) ||
        numberValue < 0 ||
        numberValue > 4294967295
    ) {
        throw new Error('Datos de resultado inválidos.');
    }
}

async function findEligibleRaffleNumber({
    drawId,
    numberValue,
    transaction,
}) {
const number = await RaffleNumber.findOne({
    where: {
        draw_id: drawId,
        value: numberValue,
        status: 'confirmed',
    },
    transaction,
});

if (!number) {
    throw new Error('Número confirmado no encontrado.');
}

const confirmedReservation = await RaffleReservation.findOne({
    where: {
        draw_id: drawId,
        status: 'confirmed',
    },
    include: [{
        model: RaffleNumber,
        as: 'numbers',
        where: { id: number.id },
        attributes: [],
        through: { attributes: [] },
        required: true,
    }],
    attributes: ['id'],
    transaction,
});

if (!confirmedReservation) {
    throw new Error(
        'El número no tiene una reserva confirmada en este sorteo.'
    );
}
    return number;
}

export async function createAdminRaffleResult({
    drawId,
    prizeId,
    numberValue,
}) {
    validateResultInput({ drawId, prizeId, numberValue });

    try {
        return await experimentsSequelize.transaction(async transaction => {
            const draw = await RaffleDraw.findByPk(drawId, {
                transaction,
                lock: transaction.LOCK.UPDATE,
            });

            if (!draw) {
                throw new Error('Sorteo no encontrado.');
            }

            if (draw.status !== 'closed') {
                throw new Error('El sorteo debe estar cerrado.');
            }

            if (draw.results_published_at !== null) {
                throw new Error('Los resultados ya están publicados.');
            }

            const prize = await RafflePrize.findOne({
                where: {
                    id: prizeId,
                    draw_id: drawId,
                },
                transaction,
            });

            if (!prize) {
                throw new Error('Premio no encontrado.');
            }

            const number = await findEligibleRaffleNumber({
                drawId,
                numberValue,
                transaction,
            });

            const existingPrizeResult = await RaffleResult.findOne({
                where: { prize_id: prizeId },
                transaction,
            });

            if (existingPrizeResult) {
                throw new Error('El premio ya tiene un resultado registrado.');
            }

            const existingNumberResult = await RaffleResult.findOne({
                where: {
                    draw_id: drawId,
                    number_id: number.id,
                },
                transaction,
            });

            if (existingNumberResult) {
                throw new Error('El número ya tiene un premio asignado.');
            }

            return RaffleResult.create({
                draw_id: drawId,
                prize_id: prizeId,
                number_id: number.id,
            }, { transaction });
        });
    } catch (error) {
        if (error instanceof UniqueConstraintError) {
            throw new Error('El premio o número ya tiene un resultado registrado.');
        }

        throw error;
    }
}

export async function updateAdminRaffleResult({
    drawId,
    prizeId,
    numberValue,
}) {
    validateResultInput({ drawId, prizeId, numberValue });

    try {
        return await experimentsSequelize.transaction(async transaction => {
            const draw = await RaffleDraw.findByPk(drawId, {
                transaction,
                lock: transaction.LOCK.UPDATE,
            });

            if (!draw) {
                throw new Error('Sorteo no encontrado.');
            }

            if (draw.status !== 'closed') {
                throw new Error('El sorteo debe estar cerrado.');
            }

            if (draw.results_published_at !== null) {
                throw new Error('Los resultados ya están publicados.');
            }

            const result = await RaffleResult.findOne({
                where: {
                    draw_id: drawId,
                    prize_id: prizeId,
                },
                transaction,
                lock: transaction.LOCK.UPDATE,
            });

            if (!result) {
                throw new Error('Resultado no encontrado.');
            }

            const number = await findEligibleRaffleNumber({
                drawId,
                numberValue,
                transaction,
            });

            if (result.number_id === number.id) {
                return result;
            }

            const existingNumberResult = await RaffleResult.findOne({
                where: {
                    draw_id: drawId,
                    number_id: number.id,
                },
                transaction,
            });

            if (existingNumberResult) {
                throw new Error('El número ya tiene un premio asignado.');
            }

            await result.update({
                number_id: number.id,
            }, { transaction });

            return result;
        });
    } catch (error) {
        if (error instanceof UniqueConstraintError) {
            throw new Error('El número ya tiene un premio asignado.');
        }

        throw error;
    }
}

export async function publishAdminRaffleResults({ drawId }) {
    if (!validateId(drawId)) {
        throw new Error('Identificador de sorteo inválido.');
    }

    return experimentsSequelize.transaction(async transaction => {
        const draw = await RaffleDraw.findByPk(drawId, {
            transaction,
            lock: transaction.LOCK.UPDATE,
        });

        if (!draw) {
            throw new Error('Sorteo no encontrado.');
        }

        if (draw.status !== 'closed') {
            throw new Error('El sorteo debe estar cerrado.');
        }

        if (draw.results_published_at !== null) {
            throw new Error('Los resultados ya están publicados.');
        }

        const prizes = await RafflePrize.findAll({
            where: { draw_id: drawId },
            attributes: ['id'],
            transaction,
        });

        if (prizes.length === 0) {
            throw new Error('El sorteo no tiene premios.');
        }

        const results = await RaffleResult.findAll({
            where: { draw_id: drawId },
            attributes: ['id', 'draw_id', 'prize_id', 'number_id'],
            transaction,
        });

        const prizeIds = new Set(prizes.map(prize => prize.id));
        const resultPrizeIds = new Set(results.map(result => result.prize_id));

        if (
            results.length !== prizes.length ||
            resultPrizeIds.size !== prizes.length ||
            results.some(result => !prizeIds.has(result.prize_id))
        ) {
            throw new Error('Todos los premios deben tener un ganador válido.');
        }

        for (const result of results) {
            const number = await RaffleNumber.findOne({
                where: {
                    id: result.number_id,
                    draw_id: drawId,
                    status: 'confirmed',
                },
                transaction,
            });

            if (!number) {
                throw new Error('Existe un número ganador no confirmado.');
            }

            const confirmedReservation = await RaffleReservation.findOne({
                where: {
                    draw_id: drawId,
                    status: 'confirmed',
                },
                include: [{
                    model: RaffleNumber,
                    as: 'numbers',
                    where: { id: number.id },
                    attributes: [],
                    through: { attributes: [] },
                    required: true,
                }],
                attributes: ['id'],
                transaction,
            });

            if (!confirmedReservation) {
                throw new Error('Existe un ganador sin reserva confirmada.');
            }
        }

        await draw.update({
            results_published_at: new Date(),
        }, { transaction });

        return draw;
    });
}
