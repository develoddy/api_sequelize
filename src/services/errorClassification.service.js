/**
 * Error Classification Service
 * 
 * Clasifica errores de Printful y otros servicios en categorías:
 * - TEMPORAL: Errores temporales que se resuelven solos (auto-retry)
 * - RECOVERABLE: Errores que requieren intervención pero son recuperables
 * - CRITICAL: Errores graves que requieren atención inmediata
 * 
 * @file src/services/errorClassification.service.js
 * @module ErrorClassificationService
 * @version 1.0.0
 * @sprint Sprint 6D - Intelligent Error Handling & Recovery
 */

/**
 * Códigos de error conocidos con su clasificación
 */
const ERROR_CODES = {
  // ============================================
  // TEMPORAL ERRORS (Auto-retry recomendado)
  // ============================================
  NETWORK_ERROR: {
    type: 'temporal',
    retryable: true,
    description: 'Error de red o conexión',
    action: 'Auto-retry con backoff'
  },
  TIMEOUT: {
    type: 'temporal',
    retryable: true,
    description: 'Timeout en la petición',
    action: 'Auto-retry con backoff'
  },
  RATE_LIMIT: {
    type: 'temporal',
    retryable: true,
    description: 'Límite de tasa excedido',
    action: 'Auto-retry después de cooldown'
  },
  SERVICE_UNAVAILABLE: {
    type: 'temporal',
    retryable: true,
    description: 'Servicio temporalmente no disponible',
    action: 'Auto-retry con backoff'
  },
  GATEWAY_TIMEOUT: {
    type: 'temporal',
    retryable: true,
    description: 'Gateway timeout (504)',
    action: 'Auto-retry con backoff'
  },
  BAD_GATEWAY: {
    type: 'temporal',
    retryable: true,
    description: 'Bad gateway (502)',
    action: 'Auto-retry con backoff'
  },
  
  // ============================================
  // RECOVERABLE ERRORS (Requieren intervención)
  // ============================================
  ADDRESS_INVALID: {
    type: 'recoverable',
    retryable: true,
    description: 'Dirección de envío inválida',
    action: 'Corrección manual + retry'
  },
  ADDRESS_INCOMPLETE: {
    type: 'recoverable',
    retryable: true,
    description: 'Dirección incompleta',
    action: 'Completar datos + retry'
  },
  PRODUCT_UNAVAILABLE: {
    type: 'recoverable',
    retryable: true,
    description: 'Producto temporalmente no disponible',
    action: 'Esperar disponibilidad o cambiar producto'
  },
  VARIANT_UNAVAILABLE: {
    type: 'recoverable',
    retryable: true,
    description: 'Variante no disponible',
    action: 'Cambiar variante + retry'
  },
  INVALID_DESIGN: {
    type: 'recoverable',
    retryable: true,
    description: 'Diseño no válido o corrupto',
    action: 'Revisar diseño + retry'
  },
  PRICE_CHANGED: {
    type: 'recoverable',
    retryable: true,
    description: 'Precio del producto cambió',
    action: 'Actualizar precio + retry'
  },
  
  // ============================================
  // CRITICAL ERRORS (No retryable sin cambios)
  // ============================================
  PAYMENT_FAILED: {
    type: 'critical',
    retryable: false,
    description: 'Pago fallido o rechazado',
    action: 'Contactar cliente para nuevo pago'
  },
  INSUFFICIENT_STOCK: {
    type: 'critical',
    retryable: false,
    description: 'Stock insuficiente permanente',
    action: 'Reembolsar o sustituir producto'
  },
  PRODUCT_NOT_FOUND: {
    type: 'critical',
    retryable: false,
    description: 'Producto no existe en catálogo',
    action: 'Revisar configuración de productos'
  },
  AUTHENTICATION_FAILED: {
    type: 'critical',
    retryable: false,
    description: 'Token de autenticación inválido',
    action: 'Verificar credenciales Printful'
  },
  AUTHORIZATION_FAILED: {
    type: 'critical',
    retryable: false,
    description: 'No autorizado para esta operación',
    action: 'Verificar permisos de API'
  },
  ACCOUNT_SUSPENDED: {
    type: 'critical',
    retryable: false,
    description: 'Cuenta de Printful suspendida',
    action: 'Contactar soporte Printful'
  },
  DUPLICATE_ORDER: {
    type: 'critical',
    retryable: false,
    description: 'Orden duplicada',
    action: 'Verificar ID de orden'
  },
  
  // ============================================
  // UNKNOWN (Clasificación por defecto)
  // ============================================
  UNKNOWN: {
    type: 'critical',
    retryable: false,
    description: 'Error desconocido',
    action: 'Revisar logs y contactar soporte'
  }
};

/**
 * Clasifica un error basándose en el código, mensaje y datos adicionales
 * 
 * @param {Object} error - Objeto de error
 * @param {string} error.code - Código del error
 * @param {string} error.message - Mensaje del error
 * @param {number} error.statusCode - Código HTTP de respuesta
 * @param {Object} error.response - Respuesta completa del servidor
 * @returns {Object} Clasificación del error
 */
export function classifyError(error) {
  try {
    // Extraer información del error
    const errorCode = error.code || error.error?.code || 'UNKNOWN';
    const errorMessage = error.message || error.error?.message || 'Unknown error';
    const statusCode = error.statusCode || error.response?.status || error.status || 0;
    const responseData = error.response?.data || error.data || null;

    // Clasificación por código HTTP
    if (statusCode >= 500) {
      return {
        errorCode: 'SERVICE_UNAVAILABLE',
        errorType: 'temporal',
        retryable: true,
        ...ERROR_CODES.SERVICE_UNAVAILABLE,
        originalError: {
          code: errorCode,
          message: errorMessage,
          statusCode
        }
      };
    }

    if (statusCode === 429) {
      return {
        errorCode: 'RATE_LIMIT',
        errorType: 'temporal',
        retryable: true,
        ...ERROR_CODES.RATE_LIMIT,
        originalError: {
          code: errorCode,
          message: errorMessage,
          statusCode
        }
      };
    }

    if (statusCode === 401 || statusCode === 403) {
      return {
        errorCode: 'AUTHENTICATION_FAILED',
        errorType: 'critical',
        retryable: false,
        ...ERROR_CODES.AUTHENTICATION_FAILED,
        originalError: {
          code: errorCode,
          message: errorMessage,
          statusCode
        }
      };
    }

    // Clasificación por código de error conocido
    if (ERROR_CODES[errorCode]) {
      return {
        errorCode,
        errorType: ERROR_CODES[errorCode].type,
        retryable: ERROR_CODES[errorCode].retryable,
        ...ERROR_CODES[errorCode],
        originalError: {
          code: errorCode,
          message: errorMessage,
          statusCode
        }
      };
    }

    // Clasificación por mensaje de error (pattern matching)
    const messageLower = errorMessage.toLowerCase();

    // Errores de red
    if (
      messageLower.includes('network') ||
      messageLower.includes('econnrefused') ||
      messageLower.includes('enotfound') ||
      messageLower.includes('etimedout') ||
      messageLower.includes('socket hang up')
    ) {
      return {
        errorCode: 'NETWORK_ERROR',
        errorType: 'temporal',
        retryable: true,
        ...ERROR_CODES.NETWORK_ERROR,
        originalError: {
          code: errorCode,
          message: errorMessage,
          statusCode
        }
      };
    }

    // Errores de dirección
    if (
      messageLower.includes('address') ||
      messageLower.includes('shipping') ||
      messageLower.includes('recipient')
    ) {
      return {
        errorCode: 'ADDRESS_INVALID',
        errorType: 'recoverable',
        retryable: true,
        ...ERROR_CODES.ADDRESS_INVALID,
        originalError: {
          code: errorCode,
          message: errorMessage,
          statusCode
        }
      };
    }

    // Errores de producto
    if (
      messageLower.includes('product') ||
      messageLower.includes('variant') ||
      messageLower.includes('out of stock') ||
      messageLower.includes('unavailable')
    ) {
      return {
        errorCode: 'PRODUCT_UNAVAILABLE',
        errorType: 'recoverable',
        retryable: true,
        ...ERROR_CODES.PRODUCT_UNAVAILABLE,
        originalError: {
          code: errorCode,
          message: errorMessage,
          statusCode
        }
      };
    }

    // Errores de pago
    if (
      messageLower.includes('payment') ||
      messageLower.includes('insufficient funds') ||
      messageLower.includes('card declined')
    ) {
      return {
        errorCode: 'PAYMENT_FAILED',
        errorType: 'critical',
        retryable: false,
        ...ERROR_CODES.PAYMENT_FAILED,
        originalError: {
          code: errorCode,
          message: errorMessage,
          statusCode
        }
      };
    }

    // Clasificación por defecto
    console.warn(`⚠️ [ERROR CLASSIFICATION] Error no clasificado: ${errorCode} - ${errorMessage}`);
    
    return {
      errorCode: 'UNKNOWN',
      errorType: 'critical',
      retryable: false,
      ...ERROR_CODES.UNKNOWN,
      originalError: {
        code: errorCode,
        message: errorMessage,
        statusCode
      }
    };

  } catch (classificationError) {
    console.error('❌ [ERROR CLASSIFICATION] Error clasificando error:', classificationError);
    return {
      errorCode: 'UNKNOWN',
      errorType: 'critical',
      retryable: false,
      ...ERROR_CODES.UNKNOWN,
      originalError: {
        code: 'CLASSIFICATION_FAILED',
        message: classificationError.message,
        statusCode: 0
      }
    };
  }
}

/**
 * Determina si un error es retryable basándose en su clasificación
 * 
 * @param {Object} errorClassification - Clasificación del error
 * @returns {boolean} True si es retryable
 */
export function isRetryable(errorClassification) {
  return errorClassification.retryable === true;
}

/**
 * Obtiene el tipo de error (temporal, recoverable, critical)
 * 
 * @param {Object} errorClassification - Clasificación del error
 * @returns {string} Tipo de error
 */
export function getErrorType(errorClassification) {
  return errorClassification.errorType || 'critical';
}

/**
 * Obtiene la acción recomendada para un error
 * 
 * @param {Object} errorClassification - Clasificación del error
 * @returns {string} Acción recomendada
 */
export function getRecommendedAction(errorClassification) {
  return errorClassification.action || 'Revisar logs y contactar soporte';
}

/**
 * Exporta todos los códigos de error para referencia
 */
export { ERROR_CODES };

export default {
  classifyError,
  isRetryable,
  getErrorType,
  getRecommendedAction,
  ERROR_CODES
};
