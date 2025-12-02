/**
 * ================================================================
 * 🔍 LOGGER UTILITY - Logs Seguros para Desarrollo y Producción
 * ================================================================
 * 
 * Este helper proporciona logging seguro que:
 * ✅ Solo funciona en desarrollo (NODE_ENV !== 'production')
 * ✅ No expone información sensible en producción
 * ✅ Mantiene console.error y console.warn siempre activos
 * 
 * IMPORTANTE: En producción, todos los logs condicionales
 * se desactivan automáticamente, PERO console.error/warn
 * permanecen para monitoreo de errores críticos.
 */

const isDevelopment = process.env.NODE_ENV !== 'production';
const isProduction = process.env.NODE_ENV === 'production';

/**
 * Logger con métodos condicionales por entorno
 */
export const logger = {
    /**
     * Log de debugging - SOLO EN DESARROLLO
     * Úsalo para debugging temporal que no debe aparecer en producción
     */
    debug: (...args) => {
        if (isDevelopment) {
            console.log('[DEBUG]', ...args);
        }
    },

    /**
     * Log informativo - SOLO EN DESARROLLO
     * Para información de flujo de aplicación
     */
    info: (...args) => {
        if (isDevelopment) {
            console.log('[INFO]', ...args);
        }
    },

    /**
     * Warning - SIEMPRE ACTIVO
     * Para advertencias que requieren atención
     */
    warn: (...args) => {
        console.warn('[WARN]', ...args);
    },

    /**
     * Error - SIEMPRE ACTIVO
     * Para errores críticos que requieren investigación
     */
    error: (...args) => {
        console.error('[ERROR]', ...args);
    },

    /**
     * Log de PayPal - SOLO EN DESARROLLO
     */
    paypal: (...args) => {
        if (isDevelopment) {
            console.log('[PayPal]', ...args);
        }
    },

    /**
     * Log de Stripe - SOLO EN DESARROLLO
     */
    stripe: (...args) => {
        if (isDevelopment) {
            console.log('[Stripe]', ...args);
        }
    },

    /**
     * Log de Printful - SOLO EN DESARROLLO
     */
    printful: (...args) => {
        if (isDevelopment) {
            console.log('[Printful]', ...args);
        }
    },

    /**
     * Log de Tracking - SOLO EN DESARROLLO
     */
    tracking: (...args) => {
        if (isDevelopment) {
            console.log('[TRACKING]', ...args);
        }
    },

    /**
     * Log de Webhook - SOLO EN DESARROLLO
     */
    webhook: (...args) => {
        if (isDevelopment) {
            console.log('[Webhook]', ...args);
        }
    },

    /**
     * Log de Sale - SOLO EN DESARROLLO
     */
    sale: (...args) => {
        if (isDevelopment) {
            console.log('[Sale Controller]', ...args);
        }
    }
};

/**
 * Helpers para sanitización de datos sensibles
 */
export const sanitize = {
    /**
     * Enmascara un email: user@domain.com → use***@domain.com
     */
    email: (email) => {
        if (!email || typeof email !== 'string') return '';
        const [user, domain] = email.split('@');
        if (!user || !domain) return email;
        return `${user.substring(0, 3)}***@${domain}`;
    },

    /**
     * Enmascara un token: abc123def456 → abc123...
     */
    token: (token) => {
        if (!token || typeof token !== 'string') return '';
        return token.substring(0, 8) + '...';
    },

    /**
     * Enmascara una tarjeta: 4242424242424242 → 4242********4242
     */
    creditCard: (card) => {
        if (!card || typeof card !== 'string') return '';
        if (card.length < 8) return '****';
        return card.substring(0, 4) + '********' + card.substring(card.length - 4);
    },

    /**
     * Remueve campos sensibles de un objeto
     */
    object: (obj, sensitiveFields = ['password', 'token', 'apiKey', 'creditCard', 'cvv']) => {
        if (!obj || typeof obj !== 'object') return obj;
        
        const sanitized = { ...obj };
        
        sensitiveFields.forEach(field => {
            if (sanitized[field]) {
                sanitized[field] = '[REDACTED]';
            }
        });
        
        return sanitized;
    }
};

/**
 * Exportar indicadores de entorno
 */
export const env = {
    isDevelopment,
    isProduction,
    nodeEnv: process.env.NODE_ENV || 'development'
};

export default logger;
