/**
 * ================================================================
 * 🚨 SENTRY CONFIGURATION - BACKEND NODE.JS ERROR MONITORING
 * ================================================================
 * 
 * Configuración de Sentry para captura automática de errores
 * en el backend Node.js. Este archivo debe importarse PRIMERO
 * en index.js para interceptar todos los errores.
 * 
 * Características:
 * - Captura automática de errores no manejados
 * - Tracking de performance en desarrollo
 * - Integración con Express.js
 * - Contexto de usuario y transacciones
 * - Diferentes configuraciones para dev/production
 * ================================================================
 */

import * as Sentry from '@sentry/node';
import '@sentry/tracing';

/**
 * 🔧 Inicializar Sentry
 */
export function initSentry() {
  const isProduction = process.env.NODE_ENV === 'production';
  
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT || (isProduction ? 'production' : 'development'),
    
    // 📊 Configuración de performance
    tracesSampleRate: parseFloat(process.env.SENTRY_SAMPLE_RATE) || (isProduction ? 0.1 : 1.0),
    
    // 🔧 Integraciones automáticas (Sentry las detecta automáticamente)
    
    // 🎯 Configuración avanzada
    beforeSend(event) {
      // Filtrar errores sensibles en producción
      if (isProduction) {
        // Remover información sensible de URLs
        if (event.request?.url) {
          event.request.url = event.request.url.replace(/password=[^&]*/gi, 'password=***');
          event.request.url = event.request.url.replace(/token=[^&]*/gi, 'token=***');
        }
        
        // Remover headers sensibles
        if (event.request?.headers) {
          delete event.request.headers['authorization'];
          delete event.request.headers['cookie'];
          delete event.request.headers['x-api-key'];
        }
      }
      
      return event;
    },
    
    // 📝 Reducir logs en desarrollo - solo errores importantes
    debug: false
  });
  
  // Configurar tags por defecto usando la nueva API
  Sentry.setTag('component', 'backend');
  Sentry.setTag('service', 'lujandev-ecommerce-api');

  // Solo loggear en desarrollo
  if (!isProduction) {
    console.log('🚨 Sentry inicializado para backend');
    console.log(`📊 Environment: ${process.env.SENTRY_ENVIRONMENT}`);
    console.log(`🎯 Sample Rate: ${process.env.SENTRY_SAMPLE_RATE}`);
  }
}

/**
 * 🛒 Middleware personalizado para tracking de requests
 */
export function sentryTracingMiddleware() {
  return (req, res, next) => {
    // Configurar tags y contexto usando la nueva API
    Sentry.setTag('http.method', req.method);
    Sentry.setTag('http.url', req.url);
    Sentry.setContext('request', {
      method: req.method,
      url: req.url,
      query: req.query,
      ip: req.ip
    });
    
    next();
  };
}

/**
 * 🚨 Middleware personalizado para captura de errores
 */
export function sentryErrorHandler() {
  return (err, req, res, next) => {
    // Solo capturar errores 4xx y 5xx
    if (err.status >= 400 || !err.status) {
      // Usar la nueva API sin withScope
      Sentry.setTag('component', 'backend');
      Sentry.setContext('request', {
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: req.body
      });
      
      Sentry.captureException(err);
    }
    
    // Continuar con el siguiente middleware de error
    next(err);
  };
}

/**
 * 🎯 Capturar error manual con contexto
 */
export function captureBackendError(error, context = {}) {
  // Usar la nueva API sin withScope
  Sentry.setContext('error_context', {
    timestamp: new Date().toISOString(),
    service: 'backend',
    ...context
  });
  
  // Capturar error
  Sentry.captureException(error);
  
  // En desarrollo, también loggear
  if (process.env.NODE_ENV !== 'production') {
    console.error('🚨 Backend Error:', error, context);
  }
}

/**
 * 🛍️ Tracking de eventos críticos e-commerce
 */
export function trackEcommerceEvent(eventName, data = {}) {
  try {
    Sentry.addBreadcrumb({
      message: `E-commerce Backend Event: ${eventName}`,
      category: 'ecommerce.backend',
      level: 'info',
      data: {
        event: eventName,
        timestamp: new Date().toISOString(),
        ...data
      }
    });
    
    // Eventos críticos que requieren captura inmediata
    const criticalEvents = [
      'payment_failed',
      'order_creation_failed', 
      'stripe_webhook_error',
      'printful_sync_error',
      'database_error'
    ];
    
    if (criticalEvents.includes(eventName)) {
      Sentry.captureMessage(`Critical Backend Event: ${eventName}`, 'error');
    }
    
  } catch (error) {
    console.error('Error tracking backend event:', error);
  }
}

/**
 * 👤 Establecer contexto de usuario
 */
export function setSentryUser(user) {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    role: user.role || 'user'
  });
}

/**
 * 🧪 Test de Sentry (solo desarrollo)
 */
export function testSentryBackend() {
  if (process.env.NODE_ENV !== 'production') {
    console.log('🧪 Testing Sentry backend integration...');
    
    // Test message
    Sentry.captureMessage('Test message from backend Sentry integration', 'info');
    
    // Test error
    const testError = new Error('Test backend error - This is expected in development');
    captureBackendError(testError, {
      source: 'manual_test_backend',
      test_type: 'integration_test'
    });
    
    // Test e-commerce event
    trackEcommerceEvent('sentry_backend_test', {
      source: 'health_check',
      status: 'success'
    });
    
    console.log('✅ Sentry backend test completed');
  }
}

export default {
  initSentry,
  sentryTracingMiddleware,
  sentryErrorHandler,
  captureBackendError,
  trackEcommerceEvent,
  setSentryUser,
  testSentryBackend
};