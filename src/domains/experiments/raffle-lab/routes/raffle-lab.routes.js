import {
    listAdminReservations,
    confirmAdminReservation,
    cancelAdminReservation,
    createAdminManualReservation,
} from '../controllers/raffle-reservations-admin.controller.js';

import { authenticateAdmin } from '../../../../middlewares/auth.middleware.js';

import {
    listAdminDraws,
    listAdminDrawNumbers,
    createAdminDraw,
    publishAdminDraw,
    closeAdminDraw,
} from '../controllers/raffle-draws-admin.controller.js';

import { Router } from 'express';

import {
    createRaffleReservation,
} from '../controllers/raffle-reservations.controller.js';

import {
    listPublicRaffleDraws,
    listPublicRaffleNumbers,
} from '../controllers/raffle-draws.controller.js';

import {
    raffleReservationLimiter,
} from '../middlewares/raffle-rate-limit.middleware.js';

const router = Router();

const adminRouter = Router();

adminRouter.use(authenticateAdmin);

adminRouter.get('/session', (req, res) => {
    return res.status(200).json({
        success: true,
        user: {
            id: req.user.id,
            name: req.user.name,
            email: req.user.email,
            rol: req.user.rol,
        },
    });
});

adminRouter.get(
    '/draws/:drawId/reservations',
    listAdminReservations
);

adminRouter.post(
    '/draws/:drawId/reservations',
    createAdminManualReservation
);

adminRouter.patch(
    '/reservations/:reservationId/confirm',
    confirmAdminReservation
);

adminRouter.patch(
    '/reservations/:reservationId/cancel',
    cancelAdminReservation
);

adminRouter.get('/draws', listAdminDraws);
adminRouter.get('/draws/:drawId/numbers', listAdminDrawNumbers);
adminRouter.post('/draws', createAdminDraw);
adminRouter.patch('/draws/:drawId/publish', publishAdminDraw);
adminRouter.patch('/draws/:drawId/close', closeAdminDraw);

router.use('/admin', adminRouter);



router.get(
    '/draws',
    listPublicRaffleDraws
);

router.get(
    '/draws/:drawId/numbers',
    listPublicRaffleNumbers
);

router.post(
    '/reservations',
    raffleReservationLimiter,
    createRaffleReservation
);

export default router;
