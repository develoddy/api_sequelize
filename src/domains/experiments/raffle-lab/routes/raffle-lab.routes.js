import { Router } from 'express';

import {
    createRaffleReservation,
} from '../controllers/raffle-reservations.controller.js';

import {
    raffleReservationLimiter,
} from '../middlewares/raffle-rate-limit.middleware.js';

const router = Router();

router.post(
    '/reservations',
    raffleReservationLimiter,
    createRaffleReservation
);

export default router;
