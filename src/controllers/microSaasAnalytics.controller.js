/**
 * Micro-SaaS Analytics Controller
 * 
 * Motor de decisiones inteligente para analizar MVPs de micro-SaaS.
 * Calcula KPIs, health scores y genera recomendaciones automatizadas.
 * 
 * @module controllers/microSaasAnalytics
 * @author Claude (GitHub Copilot)
 * @date 2026-02-09
 */

import { TrackingEvent } from '../models/TrackingEvent.js';
import { Module } from '../models/Module.js';
import { Op } from 'sequelize';

// ==========================================
// CONFIGURACIÓN DE THRESHOLDS
// ==========================================

const DECISION_THRESHOLDS = {
  // Mínimos para análisis
  min_sessions_to_analyze: 10,
  min_days_to_analyze: 3,
  
  // Crear módulo formal
  create_module_score: 70,
  create_module_downloads: 50,
  create_module_feedback_rate: 80,
  
  // Archivar MVP
  archive_score: 40,
  archive_min_sessions: 20,
  
  // Alertas
  alert_high_abandonment: 50, // % abandono en step
  alert_low_feedback_rate: 60,
  alert_feedback_decline: 15 // % decline vs prev period
};

const SCORE_WEIGHTS = {
  conversion_rate: 0.25,    // 25% - completar wizard
  helpful_rate: 0.35,       // 35% - feedback positivo
  download_rate: 0.20,      // 20% - descargas
  volume_score: 0.10,       // 10% - cantidad de sesiones
  retention_score: 0.10     // 10% - usuarios recurrentes
};

// ==========================================
// ENDPOINTS PÚBLICOS
// ==========================================

/**
 * GET /api/admin/saas/micro-saas/analytics
 * Obtener analytics de todos los micro-SaaS activos
 */
export const getAllMicroSaasAnalytics = async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    
    // 1. Obtener módulos únicos con eventos de tracking
    const modulesWithEvents = await TrackingEvent.findAll({
      attributes: [[TrackingEvent.sequelize.fn('DISTINCT', TrackingEvent.sequelize.col('module')), 'module']],
      where: {
        module: { [Op.not]: null },
        timestamp: { [Op.gte]: getDateFromPeriod(period) }
      },
      raw: true
    });
    
    const moduleKeys = modulesWithEvents.map(m => m.module).filter(Boolean);
    
    if (moduleKeys.length === 0) {
      return res.json({
        success: true,
        analytics: [],
        message: 'No micro-SaaS with tracking events found'
      });
    }
    
    // 2. Calcular analytics para cada módulo
    const analyticsPromises = moduleKeys.map(moduleKey => 
      calculateModuleAnalytics(moduleKey, period)
    );
    
    const analytics = await Promise.all(analyticsPromises);
    
    // 3. Ordenar por health score descendente
    analytics.sort((a, b) => b.healthScore - a.healthScore);
    
    res.json({
      success: true,
      analytics,
      summary: {
        total_modules: analytics.length,
        avg_score: Math.round(analytics.reduce((sum, a) => sum + a.healthScore, 0) / analytics.length),
        ready_to_promote: analytics.filter(a => a.recommendation.action === 'create_module').length,
        needs_improvement: analytics.filter(a => a.recommendation.action === 'continue').length,
        to_archive: analytics.filter(a => a.recommendation.action === 'archive').length
      }
    });
  } catch (error) {
    console.error('❌ Error getting all micro-SaaS analytics:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * GET /api/admin/saas/micro-saas/analytics/:moduleKey
 * Obtener analytics detallados de un micro-SaaS específico
 */
export const getMicroSaasAnalytics = async (req, res) => {
  try {
    const { moduleKey } = req.params;
    const { period = '30d' } = req.query;
    
    const analytics = await calculateModuleAnalytics(moduleKey, period);
    
    if (!analytics) {
      return res.status(404).json({
        success: false,
        error: 'No tracking data found for this module'
      });
    }
    
    res.json({
      success: true,
      analytics
    });
  } catch (error) {
    console.error(`❌ Error getting analytics for ${req.params.moduleKey}:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * POST /api/admin/saas/micro-saas/:moduleKey/create-module
 * Crear módulo formal desde MVP validado
 */
export const createModuleFromMVP = async (req, res) => {
  try {
    const { moduleKey } = req.params;
    const { 
      auto_activate = false,
      copy_preview_config = true,
      initial_status = 'testing'
    } = req.body;
    
    // 1. Verificar que no exista módulo con este key
    const existingModule = await Module.findOne({ where: { key: moduleKey } });
    if (existingModule) {
      return res.status(409).json({
        success: false,
        error: 'Module with this key already exists',
        module: existingModule
      });
    }
    
    // 2. Obtener analytics para usar como metadata
    const analytics = await calculateModuleAnalytics(moduleKey, '30d');
    
    if (!analytics) {
      return res.status(400).json({
        success: false,
        error: 'No tracking data found for this MVP'
      });
    }
    
    // 3. Generar configuración de preview basada en analytics
    const previewConfig = copy_preview_config ? {
      enabled: true,
      route: `/preview/${moduleKey}`,
      public_endpoint: `/api/${moduleKey}/preview`,
      show_in_store: true,
      demo_button_text: 'Try Demo - No signup required',
      generator_function: `generate${capitalize(moduleKey)}Preview`,
      conversion_config: {
        recovery_key: `${moduleKey}_preview`,
        redirect_route: `/${moduleKey}/onboarding`,
        auto_activate: true
      },
      rate_limiting: {
        max_requests: 10,
        window_minutes: 15
      }
    } : null;
    
    // 4. Crear módulo con datos del MVP
    const module = await Module.create({
      key: moduleKey,
      name: capitalize(moduleKey.replace(/-/g, ' ')),
      description: `Validated MVP - ${analytics.totalSessions} sessions, ${analytics.healthScore} score`,
      type: 'saas',
      status: initial_status,
      is_active: auto_activate,
      validation_days: 14,
      validation_target_sales: 1,
      icon: 'fa-rocket',
      color: 'primary',
      preview_config: previewConfig,
      base_price: null, // Admin debe configurar
      tagline: `Validated with ${analytics.helpful_rate}% positive feedback`
    });
    
    console.log(`✅ Module created from MVP: ${moduleKey} (ID: ${module.id})`);
    
    res.json({
      success: true,
      module: module.toJSON(),
      analytics,
      message: `Module created successfully from MVP ${moduleKey}`,
      next_steps: [
        'Configure pricing in module settings',
        'Add detailed description and screenshots',
        'Set validation targets',
        'Activate module when ready'
      ]
    });
  } catch (error) {
    console.error(`❌ Error creating module from MVP ${req.params.moduleKey}:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * POST /api/admin/saas/micro-saas/:moduleKey/decision
 * Ejecutar decisión sobre un MVP (continue/archive/create_module)
 */
export const executeMVPDecision = async (req, res) => {
  try {
    const { moduleKey } = req.params;
    const { action, reason } = req.body;
    
    if (!['continue', 'archive', 'create_module'].includes(action)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid action. Must be: continue, archive, or create_module'
      });
    }
    
    const analytics = await calculateModuleAnalytics(moduleKey, '30d');
    
    if (!analytics) {
      return res.status(404).json({
        success: false,
        error: 'No tracking data found for this module'
      });
    }
    
    let result;
    
    switch (action) {
      case 'create_module':
        // Crear módulo formal
        result = await createModuleFromMVP(
          { params: { moduleKey }, body: {} },
          { json: (data) => data, status: (code) => ({ json: (data) => data }) }
        );
        break;
        
      case 'archive':
        // Marcar eventos como archived (soft delete)
        await TrackingEvent.update(
          { 
            properties: TrackingEvent.sequelize.fn(
              'JSON_SET',
              TrackingEvent.sequelize.col('properties'),
              '$.archived',
              true
            )
          },
          { where: { module: moduleKey } }
        );
        result = { archived: true, reason };
        break;
        
      case 'continue':
        // No hacer nada, solo registrar decisión
        result = { continue: true, reason };
        break;
    }
    
    console.log(`📊 Decision executed for ${moduleKey}: ${action}`);
    
    res.json({
      success: true,
      action,
      result,
      analytics
    });
  } catch (error) {
    console.error(`❌ Error executing decision for ${req.params.moduleKey}:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * GET /api/admin/saas/micro-saas/trending
 * Obtener MVPs con mejor performance últimos 7 días
 */
export const getTrendingMVPs = async (req, res) => {
  try {
    const analytics7d = await getAllMicroSaasAnalytics(
      { query: { period: '7d' } },
      { json: (data) => data }
    );
    
    const trending = analytics7d.analytics
      .filter(a => a.healthScore >= 60)
      .slice(0, 5);
    
    res.json({
      success: true,
      trending,
      period: '7d'
    });
  } catch (error) {
    console.error('❌ Error getting trending MVPs:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// ==========================================
// FUNCIONES AUXILIARES
// ==========================================

/**
 * Calcular analytics completos de un módulo
 */
async function calculateModuleAnalytics(moduleKey, period = '30d') {
  const dateFrom = getDateFromPeriod(period);
  const dateTo = new Date();
  
  // 1. Obtener todos los eventos del módulo
  const events = await TrackingEvent.findAll({
    where: {
      module: moduleKey,
      timestamp: { [Op.gte]: dateFrom }
    },
    order: [['timestamp', 'ASC']]
  });
  
  if (events.length === 0) {
    return null;
  }
  
  // 2. Calcular métricas básicas
  const kpis = calculateKPIs(events, moduleKey);
  
  // 3. Calcular health score
  const healthScore = calculateHealthScore(kpis);
  
  // 4. Generar recomendación
  const recommendation = generateRecommendation(kpis, healthScore, events.length);
  
  // 5. Generar alertas
  const alerts = generateAlerts(kpis, healthScore, events);
  
  // 6. Calcular tendencias
  const trends = calculateTrends(events, period);
  
  return {
    moduleKey,
    moduleName: capitalize(moduleKey.replace(/-/g, ' ')),
    ...kpis,
    healthScore,
    recommendation,
    alerts,
    trends,
    period,
    date_from: dateFrom.toISOString(),
    date_to: dateTo.toISOString()
  };
}

/**
 * Calcular KPIs de eventos
 */
function calculateKPIs(events, moduleKey) {
  // Sesiones únicas (filtrar nulls/undefined)
  const sessionIds = events.map(e => e.session_id).filter(Boolean);
  const uniqueSessions = sessionIds.length > 0 ? new Set(sessionIds).size : 0;
  
  // Usuarios únicos (filtrar nulls/undefined)
  const userIds = events.map(e => e.user_id).filter(Boolean);
  const uniqueUsers = userIds.length > 0 ? new Set(userIds).size : 0;
  
  // Eventos específicos por tipo
  const wizardStarts = events.filter(e => 
    e.event.includes('wizard_started') || e.event.includes('preview_started')
  ).length;
  
  const wizardCompletions = events.filter(e => {
    try {
      const props = JSON.parse(e.properties || '{}');
      return (
        e.event.includes('completed') && 
        (props.step === 4 || props.completed === true)
      );
    } catch {
      return false;
    }
  }).length;
  
  const downloads = events.filter(e => 
    e.event.includes('download') || e.event.includes('generated')
  ).length;
  
  // Feedback
  const feedbackEvents = events.filter(e => 
    e.event.includes('feedback')
  );
  
  const helpfulFeedback = feedbackEvents.filter(e => {
    try {
      const props = JSON.parse(e.properties || '{}');
      return props.helpful === true;
    } catch {
      return false;
    }
  }).length;
  
  // Objetivos (específico para video-express)
  const objectiveEvents = events.filter(e => {
    try {
      const props = JSON.parse(e.properties || '{}');
      return props.objective;
    } catch {
      return false;
    }
  });
  
  const organicCount = objectiveEvents.filter(e => {
    try {
      return JSON.parse(e.properties || '{}').objective === 'organic';
    } catch {
      return false;
    }
  }).length;
  
  const adsCount = objectiveEvents.filter(e => {
    try {
      return JSON.parse(e.properties || '{}').objective === 'ads';
    } catch {
      return false;
    }
  }).length;
  
  // Tasas de conversión
  const conversion_rate = wizardStarts > 0 
    ? Math.round((wizardCompletions / wizardStarts) * 100) 
    : 0;
    
  const download_rate = wizardCompletions > 0 
    ? Math.round((downloads / wizardCompletions) * 100) 
    : 0;
    
  const feedback_rate = wizardCompletions > 0 
    ? Math.round((feedbackEvents.length / wizardCompletions) * 100) 
    : 0;
    
  const helpful_rate = feedbackEvents.length > 0 
    ? Math.round((helpfulFeedback / feedbackEvents.length) * 100) 
    : 0;
  
  // Usuarios recurrentes (multiple sessions)
  const sessionsByUser = {};
  events.forEach(e => {
    const id = e.user_id || e.session_id;
    if (id) {
      sessionsByUser[id] = (sessionsByUser[id] || 0) + 1;
    }
  });
  
  const returningUsers = Object.values(sessionsByUser).filter(count => count > 1).length;
  const retention_rate = uniqueSessions > 0 
    ? Math.round((returningUsers / uniqueSessions) * 100) 
    : 0;
  
  // Flag de datos insuficientes
  const insufficient_data = (
    uniqueSessions < 5 || 
    wizardStarts < 3 || 
    feedbackEvents.length < 3
  );
  
  return {
    totalSessions: uniqueSessions,
    uniqueUsers,
    wizard_starts: wizardStarts,
    wizard_completions: wizardCompletions,
    downloads,
    total_feedback: feedbackEvents.length,
    helpful_feedback: helpfulFeedback,
    organic_count: organicCount,
    ads_count: adsCount,
    conversion_rate,
    download_rate,
    feedback_rate,
    helpful_rate,
    retention_rate,
    returningUsers,
    insufficient_data,
    // Metadata adicional para debug
    _meta: {
      total_events: events.length,
      events_with_session_id: sessionIds.length,
      events_with_user_id: userIds.length,
      unique_identifiers: Object.keys(sessionsByUser).length
    }
  };
}

/**
 * Calcular Health Score (0-100)
 * Con penalización por datos insuficientes
 */
function calculateHealthScore(kpis) {
  // Si hay datos insuficientes, penalizar el score
  if (kpis.insufficient_data) {
    // Score basado solo en lo que tenemos, pero con cap máximo de 50
    const volume_score = Math.min((kpis.totalSessions / 100) * 100, 100);
    
    const rawScore = Math.round(
      (kpis.conversion_rate * SCORE_WEIGHTS.conversion_rate) +
      (kpis.helpful_rate * SCORE_WEIGHTS.helpful_rate) +
      (kpis.download_rate * SCORE_WEIGHTS.download_rate) +
      (volume_score * SCORE_WEIGHTS.volume_score) +
      (kpis.retention_rate * SCORE_WEIGHTS.retention_score)
    );
    
    // Cap a 50 para indicar que necesita más datos
    return Math.max(0, Math.min(50, rawScore));
  }
  
  // Normalizar volume score (0-100 por sesiones)
  const volume_score = Math.min((kpis.totalSessions / 100) * 100, 100);
  
  const score = Math.round(
    (kpis.conversion_rate * SCORE_WEIGHTS.conversion_rate) +
    (kpis.helpful_rate * SCORE_WEIGHTS.helpful_rate) +
    (kpis.download_rate * SCORE_WEIGHTS.download_rate) +
    (volume_score * SCORE_WEIGHTS.volume_score) +
    (kpis.retention_rate * SCORE_WEIGHTS.retention_score)
  );
  
  return Math.max(0, Math.min(100, score));
}

/**
 * Generar recomendación automatizada
 */
function generateRecommendation(kpis, healthScore, totalEvents) {
  const { 
    create_module_score,
    create_module_downloads,
    create_module_feedback_rate,
    archive_score,
    archive_min_sessions,
    min_sessions_to_analyze
  } = DECISION_THRESHOLDS;
  
  // CASO PRIORITARIO: Datos insuficientes
  if (kpis.insufficient_data) {
    return {
      action: 'continue',
      confidence: 'low',
      reason: `Datos insuficientes para decidir. Solo ${kpis.totalSessions} sesiones, ${kpis.total_feedback} feedbacks. Score: ${healthScore} (con penalización por poca data).`,
      next_steps: [
        'Continuar recolectando datos (mín: 5 sesiones, 3 feedbacks)',
        'Promocionar MVP en redes sociales',
        'Solicitar feedback directo a usuarios',
        'Revisar tracking de session_id'
      ]
    };
  }
  
  // Caso 1: Crear módulo formal
  if (
    healthScore >= create_module_score &&
    kpis.downloads >= create_module_downloads &&
    kpis.helpful_rate >= create_module_feedback_rate
  ) {
    return {
      action: 'create_module',
      confidence: 'high',
      reason: `Excelente performance: Score ${healthScore}, ${kpis.downloads} descargas, ${kpis.helpful_rate}% feedback positivo`,
      next_steps: [
        'Crear módulo formal en Gestión de Módulos',
        'Configurar pricing y planes',
        'Preparar documentación',
        'Lanzar público'
      ]
    };
  }
  
  // Caso 2: Archivar
  if (
    kpis.totalSessions >= archive_min_sessions &&
    healthScore < archive_score
  ) {
    return {
      action: 'archive',
      confidence: 'medium',
      reason: `Score bajo (${healthScore}) después de ${kpis.totalSessions} sesiones. No validó el dolor de usuario.`,
      next_steps: [
        'Archivar MVP',
        'Analizar feedback negativo',
        'Considerar pivot o nuevo MVP'
      ]
    };
  }
  
  // Caso 3: Necesita mejoras específicas
  if (kpis.conversion_rate < 50) {
    return {
      action: 'continue',
      confidence: 'low',
      reason: `Baja conversión (${kpis.conversion_rate}%). Mejorar UX del wizard.`,
      next_steps: [
        'Analizar abandono por paso',
        'Simplificar formularios',
        'Agregar ayuda contextual'
      ]
    };
  }
  
  if (kpis.helpful_rate < 60 && kpis.total_feedback > 5) {
    return {
      action: 'continue',
      confidence: 'low',
      reason: `Feedback negativo alto (${100 - kpis.helpful_rate}%). Mejorar calidad del output.`,
      next_steps: [
        'Revisar feedback negativo',
        'Mejorar algoritmo generador',
        'Ajustar expectativas del usuario'
      ]
    };
  }
  
  // Caso 4: Continuar validando (default)
  if (kpis.totalSessions < min_sessions_to_analyze) {
    return {
      action: 'continue',
      confidence: 'low',
      reason: `Pocas sesiones (${kpis.totalSessions}). Necesita más datos para decidir.`,
      next_steps: [
        'Continuar validando',
        'Promocionar en redes',
        'Pedir feedback directo'
      ]
    };
  }
  
  return {
    action: 'continue',
    confidence: 'medium',
    reason: `En validación. Score: ${healthScore}. Mejorar métricas antes de decidir.`,
    next_steps: [
      'Incrementar volumen',
      'Mejorar feedback rate',
      'Optimizar conversión'
    ]
  };
}

/**
 * Generar alertas inteligentes
 */
function generateAlerts(kpis, healthScore, events) {
  const alerts = [];
  
  // 🚨 Alert PRIORITARIO: Datos insuficientes
  if (kpis.insufficient_data) {
    const missingData = [];
    if (kpis.totalSessions < 5) missingData.push(`${kpis.totalSessions} sesiones (mín: 5)`);
    if (kpis.wizard_starts < 3) missingData.push(`${kpis.wizard_starts} wizard starts (mín: 3)`);
    if (kpis.total_feedback < 3) missingData.push(`${kpis.total_feedback} feedbacks (mín: 3)`);
    
    alerts.push({
      type: 'warning',
      title: '📊 Datos Insuficientes',
      message: `MVP con poca data: ${missingData.join(', ')}. Los KPIs pueden no ser representativos.`,
      action: 'collect_more_data',
      priority: 'high'
    });
  }
  
  // ⚠️ Alert: Métricas inconsistentes (wizard starts > sesiones)
  if (kpis.wizard_starts > kpis.totalSessions * 3) {
    alerts.push({
      type: 'info',
      title: '⚠️ Métrica Inconsistente',
      message: `${kpis.wizard_starts} wizard starts vs ${kpis.totalSessions} sesiones. Revisar tracking de session_id.`,
      action: 'check_tracking',
      priority: 'medium'
    });
  }
  
  // ✅ Alert: Listo para módulo
  if (
    !kpis.insufficient_data &&
    healthScore >= DECISION_THRESHOLDS.create_module_score &&
    kpis.downloads >= DECISION_THRESHOLDS.create_module_downloads
  ) {
    alerts.push({
      type: 'success',
      title: '🎉 MVP Validado',
      message: `¡Listo para crear módulo formal! Score ${healthScore}, ${kpis.downloads} descargas.`,
      action: 'create_module',
      priority: 'high'
    });
  }
  
  // ⚠️ Alert: Baja conversión
  if (kpis.conversion_rate < 50 && kpis.wizard_starts >= 20) {
    alerts.push({
      type: 'warning',
      title: '⚠️ Baja Conversión',
      message: `Solo ${kpis.conversion_rate}% completa el wizard. Revisar UX.`,
      action: 'improve_ux',
      priority: 'medium'
    });
  }
  
  // ⚠️ Alert: Feedback negativo alto
  if (kpis.helpful_rate < 60 && kpis.total_feedback >= 10) {
    alerts.push({
      type: 'warning',
      title: '😞 Feedback Negativo Alto',
      message: `${100 - kpis.helpful_rate}% feedback negativo. Mejorar calidad.`,
      action: 'improve_quality',
      priority: 'high'
    });
  }
  
  // 🔥 Alert: Alta demanda
  if (kpis.totalSessions > 100 && events.length > 500) {
    alerts.push({
      type: 'info',
      title: '🔥 Alta Demanda',
      message: `${kpis.totalSessions} sesiones. Gran interés del mercado.`,
      action: 'scale_up',
      priority: 'low'
    });
  }
  
  // ℹ️ Alert: Pocas descargas
  if (kpis.download_rate < 50 && kpis.wizard_completions >= 20) {
    alerts.push({
      type: 'info',
      title: 'ℹ️ Pocas Descargas',
      message: `Solo ${kpis.download_rate}% descarga. Agregar CTA más visible.`,
      action: 'improve_cta',
      priority: 'low'
    });
  }
  
  // ❌ Alert: Pocas sesiones (solo si no hay alert de insufficient_data)
  if (!kpis.insufficient_data && kpis.totalSessions < DECISION_THRESHOLDS.min_sessions_to_analyze) {
    alerts.push({
      type: 'info',
      title: '📊 Necesita Más Datos',
      message: `Solo ${kpis.totalSessions} sesiones. Promocionar más.`,
      action: 'promote',
      priority: 'low'
    });
  }
  
  return alerts;
}

/**
 * Calcular tendencias vs período anterior
 */
function calculateTrends(events, period) {
  const now = new Date();
  const periodMs = getPeriodInMs(period);
  const halfPeriodDate = new Date(now.getTime() - (periodMs / 2));
  
  const recentEvents = events.filter(e => new Date(e.timestamp) >= halfPeriodDate);
  const oldEvents = events.filter(e => new Date(e.timestamp) < halfPeriodDate);
  
  const calculateMetric = (eventList, metric) => {
    switch (metric) {
      case 'sessions':
        return new Set(eventList.map(e => e.session_id)).size;
      case 'completions':
        return eventList.filter(e => {
          try {
            const props = JSON.parse(e.properties || '{}');
            return props.step === 4 || props.completed === true;
          } catch {
            return false;
          }
        }).length;
      case 'downloads':
        return eventList.filter(e => e.event.includes('download')).length;
      default:
        return 0;
    }
  };
  
  const recentSessions = calculateMetric(recentEvents, 'sessions');
  const oldSessions = calculateMetric(oldEvents, 'sessions');
  const recentCompletions = calculateMetric(recentEvents, 'completions');
  const oldCompletions = calculateMetric(oldEvents, 'completions');
  const recentDownloads = calculateMetric(recentEvents, 'downloads');
  const oldDownloads = calculateMetric(oldEvents, 'downloads');
  
  const calculateChange = (recent, old) => {
    if (old === 0) return recent > 0 ? 100 : 0;
    return Math.round(((recent - old) / old) * 100);
  };
  
  return {
    sessions_change: calculateChange(recentSessions, oldSessions),
    completions_change: calculateChange(recentCompletions, oldCompletions),
    downloads_change: calculateChange(recentDownloads, oldDownloads),
    trend_direction: calculateChange(recentSessions, oldSessions) > 0 ? 'up' : 'down'
  };
}

/**
 * Obtener fecha desde período
 */
function getDateFromPeriod(period) {
  const now = new Date();
  const periodMs = getPeriodInMs(period);
  return new Date(now.getTime() - periodMs);
}

/**
 * Obtener período en milisegundos
 */
function getPeriodInMs(period) {
  const periods = {
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
    '90d': 90 * 24 * 60 * 60 * 1000,
    'all': 365 * 24 * 60 * 60 * 1000
  };
  
  return periods[period] || periods['30d'];
}

/**
 * Capitalizar primera letra
 */
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
