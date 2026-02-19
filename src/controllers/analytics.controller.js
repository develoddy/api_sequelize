/**
 * Analytics Controller
 * 
 * Recibe eventos de tracking desde el frontend para análisis de métricas.
 * Permite medir el funnel completo desde preview hasta activación.
 * 
 * @module controllers/analytics
 */

import { TrackingEvent } from '../models/TrackingEvent.js';
import { Op } from 'sequelize';

/**
 * Recibir evento de tracking
 * POST /api/tracking/events
 * 
 * Detecta si es tracking interno (admin) vs público (preview)
 * para mantener métricas limpias en Analytics.
 */
export const trackEvent = async (req, res) => {
  try {
    const {
      event,
      properties = {},
      timestamp,
      sessionId,
      userId,
      tenantId,
      module,
      source
    } = req.body;
    
    if (!event) {
      return res.status(400).json({
        success: false,
        error: 'Event name is required'
      });
    }
    
    // ✅ FASE 2: Detectar tracking interno vs público
    // Si source viene como 'admin' o 'internal' desde el frontend, mantenerlo
    // Esto permite que Analytics excluya tracking de pruebas internas
    const finalSource = source || 'preview'; // Default: preview (público)
    
    // 🔍 DEBUG: Log temporal para verificar headers de IP
    if (process.env.NODE_ENV !== 'production' || process.env.DEBUG_IP === 'true') {
      console.log('🔍 IP Debug:', {
        'x-forwarded-for': req.headers['x-forwarded-for'],
        'x-real-ip': req.headers['x-real-ip'],
        'req.ip': req.ip,
        'remoteAddress': req.connection?.remoteAddress,
        'socketAddress': req.socket?.remoteAddress,
        module,
        sessionId
      });
    }
    
    // Guardar evento en DB
    const trackingEvent = await TrackingEvent.create({
      event,
      properties: JSON.stringify(properties),
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      session_id: sessionId,
      user_id: userId,
      tenant_id: tenantId,
      module,
      source: finalSource,  // ✅ Guardar source distinguido
      user_agent: req.headers['user-agent'],
      // ✅ Capturar IP real incluso detrás de proxies/CDN
      ip_address: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
                  req.headers['x-real-ip'] || 
                  req.connection?.remoteAddress || 
                  req.socket?.remoteAddress || 
                  req.ip,
      created_at: new Date()
    });
    
    // Log en desarrollo
    if (process.env.NODE_ENV !== 'production') {
      console.log('📊 [Tracking Event]:', {
        event,
        sessionId,
        userId,
        tenantId,
        module,
        source: finalSource,
        isInternal: finalSource === 'admin' || finalSource === 'internal'
      });
    }
    
    res.json({
      success: true,
      eventId: trackingEvent.id
    });
    
  } catch (error) {
    console.error('❌ Error tracking event:', error);
    
    // No fallar fuertemente, solo logear
    res.status(500).json({
      success: false,
      error: 'Failed to track event'
    });
  }
};

/**
 * Obtener métricas agregadas del funnel
 * GET /api/tracking/funnel/:module
 */
export const getFunnelMetrics = async (req, res) => {
  try {
    const { module } = req.params;
    const { startDate, endDate } = req.query;
    
    // Construir filtros
    const whereClause = { module };
    
    if (startDate || endDate) {
      whereClause.timestamp = {};
      if (startDate) whereClause.timestamp[Op.gte] = new Date(startDate);
      if (endDate) whereClause.timestamp[Op.lte] = new Date(endDate);
    }
    
    // Obtener eventos
    const events = await TrackingEvent.findAll({
      where: whereClause,
      attributes: ['event', 'session_id', 'user_id', 'tenant_id', 'timestamp', 'properties'],
      order: [['timestamp', 'ASC']]
    });
    
    // Calcular métricas del funnel
    const metrics = calculateFunnelMetrics(events);
    
    res.json({
      success: true,
      module,
      period: { startDate, endDate },
      metrics
    });
    
  } catch (error) {
    console.error('❌ Error getting funnel metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get funnel metrics'
    });
  }
};

/**
 * Obtener eventos por sesión
 * GET /api/tracking/session/:sessionId
 */
export const getSessionEvents = async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const events = await TrackingEvent.findAll({
      where: { session_id: sessionId },
      order: [['timestamp', 'ASC']]
    });
    
    res.json({
      success: true,
      sessionId,
      events: events.map(e => ({
        event: e.event,
        properties: JSON.parse(e.properties || '{}'),
        timestamp: e.timestamp,
        module: e.module,
        source: e.source
      }))
    });
    
  } catch (error) {
    console.error('❌ Error getting session events:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get session events'
    });
  }
};

/**
 * Obtener tasa de conversión por módulo
 * GET /api/tracking/conversion-rate/:module
 */
export const getConversionRate = async (req, res) => {
  try {
    const { module } = req.params;
    const { startDate, endDate } = req.query;
    
    const whereClause = { module };
    
    if (startDate || endDate) {
      whereClause.timestamp = {};
      if (startDate) whereClause.timestamp[Op.gte] = new Date(startDate);
      if (endDate) whereClause.timestamp[Op.lte] = new Date(endDate);
    }
    
    // Contar eventos clave
    const [
      previewsStarted,
      previewsGenerated,
      conversionsStarted,
      registrationsCompleted
    ] = await Promise.all([
      TrackingEvent.count({ where: { ...whereClause, event: 'page_view', source: 'preview' } }),
      TrackingEvent.count({ where: { ...whereClause, event: 'preview_generated' } }),
      TrackingEvent.count({ where: { ...whereClause, event: 'conversion_started' } }),
      TrackingEvent.count({ where: { ...whereClause, event: 'registration_completed' } })
    ]);
    
    // Calcular tasas
    const previewToSignup = previewsGenerated > 0 
      ? (conversionsStarted / previewsGenerated * 100).toFixed(2) 
      : 0;
      
    const signupToRegistration = conversionsStarted > 0 
      ? (registrationsCompleted / conversionsStarted * 100).toFixed(2) 
      : 0;
      
    const overallConversion = previewsStarted > 0 
      ? (registrationsCompleted / previewsStarted * 100).toFixed(2) 
      : 0;
    
    res.json({
      success: true,
      module,
      period: { startDate, endDate },
      funnel: {
        previewsStarted,
        previewsGenerated,
        conversionsStarted,
        registrationsCompleted
      },
      conversionRates: {
        previewToSignup: `${previewToSignup}%`,
        signupToRegistration: `${signupToRegistration}%`,
        overall: `${overallConversion}%`
      }
    });
    
  } catch (error) {
    console.error('❌ Error calculating conversion rate:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate conversion rate'
    });
  }
};

// ========== Helpers ==========

/**
 * Calcular métricas del funnel desde eventos
 */
function calculateFunnelMetrics(events) {
  const sessionMap = new Map();
  
  events.forEach(event => {
    const sessionId = event.session_id;
    
    if (!sessionMap.has(sessionId)) {
      sessionMap.set(sessionId, {
        sessionId,
        userId: event.user_id,
        tenantId: event.tenant_id,
        wizardStarted: false,
        stepsCompleted: [],
        previewGenerated: false,
        conversionStarted: false,
        registrationCompleted: false,
        moduleActivated: false,
        firstEvent: event.timestamp,
        lastEvent: event.timestamp
      });
    }
    
    const session = sessionMap.get(sessionId);
    session.lastEvent = event.timestamp;
    
    // Actualizar flags según evento
    switch (event.event) {
      case 'page_view':
        session.wizardStarted = true;
        break;
      case 'wizard_step_completed':
        const step = JSON.parse(event.properties || '{}').step;
        if (step && !session.stepsCompleted.includes(step)) {
          session.stepsCompleted.push(step);
        }
        break;
      case 'preview_generated':
        session.previewGenerated = true;
        break;
      case 'conversion_started':
        session.conversionStarted = true;
        break;
      case 'registration_completed':
        session.registrationCompleted = true;
        break;
      case 'module_activated':
        session.moduleActivated = true;
        break;
    }
  });
  
  const sessions = Array.from(sessionMap.values());
  
  return {
    totalSessions: sessions.length,
    wizardStarted: sessions.filter(s => s.wizardStarted).length,
    previewsGenerated: sessions.filter(s => s.previewGenerated).length,
    conversionsStarted: sessions.filter(s => s.conversionStarted).length,
    registrationsCompleted: sessions.filter(s => s.registrationCompleted).length,
    modulesActivated: sessions.filter(s => s.moduleActivated).length,
    
    // Drop-off points
    dropOffWizard: sessions.filter(s => s.wizardStarted && !s.previewGenerated).length,
    dropOffPreview: sessions.filter(s => s.previewGenerated && !s.conversionStarted).length,
    dropOffSignup: sessions.filter(s => s.conversionStarted && !s.registrationCompleted).length,
    
    // Tasas de conversión
    previewToSignup: sessions.filter(s => s.previewGenerated).length > 0
      ? (sessions.filter(s => s.conversionStarted).length / sessions.filter(s => s.previewGenerated).length * 100).toFixed(2) + '%'
      : '0%',
      
    signupToRegistration: sessions.filter(s => s.conversionStarted).length > 0
      ? (sessions.filter(s => s.registrationCompleted).length / sessions.filter(s => s.conversionStarted).length * 100).toFixed(2) + '%'
      : '0%',
      
    registrationToActivation: sessions.filter(s => s.registrationCompleted).length > 0
      ? (sessions.filter(s => s.moduleActivated).length / sessions.filter(s => s.registrationCompleted).length * 100).toFixed(2) + '%'
      : '0%',
      
    overallConversion: sessions.filter(s => s.wizardStarted).length > 0
      ? (sessions.filter(s => s.moduleActivated).length / sessions.filter(s => s.wizardStarted).length * 100).toFixed(2) + '%'
      : '0%'
  };
}

export default {
  trackEvent,
  getFunnelMetrics,
  getSessionEvents,
  getConversionRate
};
