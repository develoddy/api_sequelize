import {
    uploadRafflePrizeImage,
} from '../middlewares/raffle-prize-upload.middleware.js';
import { uploadRaffleBanner } from '../middlewares/raffle-banner-upload.middleware.js';
import {
    handleRaffleBannerUpload,
    uploadAdminDrawBanner,
    removeAdminDrawBanner,
    handleRaffleBannerUploadError,
} from '../controllers/raffle-banner-admin.controller.js';

import {
    listAdminReservations,
    confirmAdminReservation,
    cancelAdminReservation,
    createAdminManualReservation,
    updateAdminParticipant,
    changeAdminNumbers,
} from '../controllers/raffle-reservations-admin.controller.js';

import { authenticateAdmin } from '../../../../middlewares/auth.middleware.js';

import {
    listAdminDraws,
    listAdminDrawNumbers,
    createAdminDraw,
    publishAdminDraw,
    closeAdminDraw,
    updateAdminDrawPresentation,
} from '../controllers/raffle-draws-admin.controller.js';

import {
    listPublicRafflePrizes,
} from '../controllers/raffle-prizes.controller.js';

import {
    listAdminRafflePrizes,
    createAdminRafflePrize,
    updateAdminRafflePrize,
    deleteAdminRafflePrize,
    handleRafflePrizeImageUpload,
    handleRafflePrizeImageUploadError,
    uploadAdminRafflePrizeImage,
    removeAdminRafflePrizeImage,
} from '../controllers/raffle-prizes-admin.controller.js';

import {
    listAdminRaffleResults,
    createAdminRaffleResult,
    updateAdminRaffleResult,
    publishAdminRaffleResults,
} from '../controllers/raffle-results-admin.controller.js';

import {
    listPublicRaffleResults,
} from '../controllers/raffle-results.controller.js';

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
    '/reservations/:reservationId/participant',
    updateAdminParticipant
);

adminRouter.patch(
    '/reservations/:reservationId/numbers',
    changeAdminNumbers
);

adminRouter.patch(
    '/reservations/:reservationId/confirm',
    confirmAdminReservation
);

adminRouter.patch(
    '/reservations/:reservationId/cancel',
    cancelAdminReservation
);

adminRouter.get(
    '/draws/:drawId/prizes',
    listAdminRafflePrizes
);

adminRouter.post(
    '/draws/:drawId/prizes',
    createAdminRafflePrize
);

adminRouter.patch(
    '/draws/:drawId/prizes/:prizeId',
    updateAdminRafflePrize
);

adminRouter.delete(
    '/draws/:drawId/prizes/:prizeId',
    deleteAdminRafflePrize
);

adminRouter.get(
    '/draws/:drawId/results',
    listAdminRaffleResults
);

adminRouter.post(
    '/draws/:drawId/results',
    createAdminRaffleResult
);

adminRouter.patch(
    '/draws/:drawId/results/publish',
    publishAdminRaffleResults
);

adminRouter.patch(
    '/draws/:drawId/results/:prizeId',
    updateAdminRaffleResult
);

adminRouter.get('/draws', listAdminDraws);
adminRouter.get('/draws/:drawId/numbers', listAdminDrawNumbers);
adminRouter.post('/draws', createAdminDraw);
adminRouter.post(
    '/draws/:drawId/banner',
    handleRaffleBannerUpload,
    uploadRaffleBanner,
    uploadAdminDrawBanner,
    handleRaffleBannerUploadError
);

adminRouter.delete(
    '/draws/:drawId/banner/:variant',
    handleRaffleBannerUpload,
    removeAdminDrawBanner
);

adminRouter.patch(
    '/draws/:drawId/presentation',
    updateAdminDrawPresentation
);
adminRouter.patch('/draws/:drawId/publish', publishAdminDraw);
adminRouter.patch('/draws/:drawId/close', closeAdminDraw);


adminRouter.post(
    '/draws/:drawId/prizes/:prizeId/image',
    handleRafflePrizeImageUpload,
    uploadRafflePrizeImage,
    handleRafflePrizeImageUploadError,
    uploadAdminRafflePrizeImage
);

adminRouter.delete(
    '/draws/:drawId/prizes/:prizeId/image',
    removeAdminRafflePrizeImage
);

router.use('/admin', adminRouter);



router.get(
    '/draws',
    listPublicRaffleDraws
);

router.get(
    '/draws/:drawId/numbers',
    listPublicRaffleNumbers
);

router.get(
    '/draws/:drawId/prizes',
    listPublicRafflePrizes
);

router.get(
    '/draws/:drawId/results',
    listPublicRaffleResults
);

router.post(
    '/reservations',
    raffleReservationLimiter,
    createRaffleReservation
);

export default router;
