import { RaffleDraw } from './raffle-draw.model.js';
import { RafflePrize } from './raffle-prize.model.js';
import { RaffleResult } from './raffle-result.model.js';
import { RaffleNumber } from './raffle-number.model.js';
import { RaffleReservation } from './raffle-reservation.model.js';
import { RaffleReservationNumber } from './raffle-reservation-number.model.js';

RaffleDraw.hasMany(RafflePrize, {
    foreignKey: 'draw_id',
    as: 'prizes',
});

RafflePrize.belongsTo(RaffleDraw, {
    foreignKey: 'draw_id',
    as: 'draw',
});

RaffleDraw.hasMany(RaffleNumber, {
    foreignKey: 'draw_id',
    as: 'numbers',
});

RaffleNumber.belongsTo(RaffleDraw, {
    foreignKey: 'draw_id',
    as: 'draw',
});

RaffleDraw.hasMany(RaffleReservation, {
    foreignKey: 'draw_id',
    as: 'reservations',
});

RaffleReservation.belongsTo(RaffleDraw, {
    foreignKey: 'draw_id',
    as: 'draw',
});

RaffleReservation.belongsToMany(RaffleNumber, {
    through: RaffleReservationNumber,
    foreignKey: 'reservation_id',
    otherKey: 'number_id',
    as: 'numbers',
});

RaffleNumber.belongsToMany(RaffleReservation, {
    through: RaffleReservationNumber,
    foreignKey: 'number_id',
    otherKey: 'reservation_id',
    as: 'reservations',
});

RaffleDraw.hasMany(RaffleResult, {
    foreignKey: 'draw_id',
    as: 'results',
});

RaffleResult.belongsTo(RaffleDraw, {
    foreignKey: 'draw_id',
    as: 'draw',
});

RafflePrize.hasOne(RaffleResult, {
    foreignKey: 'prize_id',
    as: 'result',
});

RaffleResult.belongsTo(RafflePrize, {
    foreignKey: 'prize_id',
    as: 'prize',
});

RaffleNumber.hasOne(RaffleResult, {
    foreignKey: 'number_id',
    as: 'result',
});

RaffleResult.belongsTo(RaffleNumber, {
    foreignKey: 'number_id',
    as: 'number',
});

export {
    RaffleDraw,
    RafflePrize,
    RaffleResult,
    RaffleNumber,
    RaffleReservation,
    RaffleReservationNumber,
};
