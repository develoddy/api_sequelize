import { RaffleDraw } from './raffle-draw.model.js';
import { RafflePrize } from './raffle-prize.model.js';
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

export {
    RaffleDraw,
    RafflePrize,
    RaffleNumber,
    RaffleReservation,
    RaffleReservationNumber,
};
