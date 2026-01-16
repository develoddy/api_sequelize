import rateLimit from 'express-rate-limit';

/**
 * Rate limiter para registro de usuarios
 * Máximo 50 registros por hora por IP (ajustado para testing)
 */
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: process.env.NODE_ENV === 'production' ? 20 : 100, // 🔧 20 en prod, 100 en dev
  message: {
    success: false,
    message: 'Demasiados intentos de registro. Por favor intenta de nuevo en 1 hora.'
  },
  standardHeaders: true,
  legacyHeaders: false
  // Por defecto usa req.ip que es seguro para IPv6
});

/**
 * Rate limiter para login
 * Máximo 10 intentos por hora por IP
 */
export const loginLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 10,
  message: {
    success: false,
    message: 'Demasiados intentos de login. Por favor intenta de nuevo en 1 hora.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true // No contar logins exitosos
  // Por defecto usa req.ip que es seguro para IPv6
});

/**
 * Rate limiter para endpoints de Stripe
 * Máximo 20 requests por hora por IP
 */
export const stripeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 20,
  message: {
    success: false,
    message: 'Demasiadas solicitudes de pago. Por favor intenta de nuevo más tarde.'
  },
  standardHeaders: true,
  legacyHeaders: false
  // Por defecto usa req.ip que es seguro para IPv6
});

/**
 * Rate limiter general para APIs públicas
 * Máximo 100 requests por 15 minutos
 */
export const generalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100,
  message: {
    success: false,
    message: 'Demasiadas solicitudes. Por favor intenta de nuevo en 15 minutos.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Rate limiter estricto para acciones sensibles
 * Máximo 3 intentos por 15 minutos
 */
export const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 3,
  message: {
    success: false,
    message: 'Demasiados intentos. Por favor intenta de nuevo en 15 minutos.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

export default {
  registerLimiter,
  loginLimiter,
  stripeLimiter,
  generalApiLimiter,
  strictLimiter
};
