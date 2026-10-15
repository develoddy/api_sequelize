import rateLimit from 'express-rate-limit';

export const raffleReservationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: process.env.NODE_ENV === 'production' ? 5 : 50,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Demasiados intentos de reserva. Inténtalo de nuevo más tarde.',
    },
});
