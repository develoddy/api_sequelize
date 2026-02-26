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
 * Obtener analytics de todos los módulos activos
 * 
 * ✅ CORRECCIÓN: Obtiene módulos desde tabla 'modules' (LEFT JOIN)
 * No desde 'tracking_events' (INNER JOIN)
 * 
 * Principio: Module = MVP
 * Un módulo sin tracking sigue siendo un MVP en validación
 */
export const getAllMicroSaasAnalytics = async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    
    console.log(`📊 Obteniendo analytics de módulos activos (período: ${period})...`);
    
    // ✅ 1. Obtener módulos DESDE la tabla modules (no desde tracking_events)
    const activeModules = await Module.findAll({
      where: {
        status: { [Op.in]: ['testing', 'live'] },
        is_active: true
      },
      attributes: ['key', 'name', 'status', 'launched_at', 'validation_days', 'validation_target_sales'],
      order: [['created_at', 'DESC']]
    });
    
    if (activeModules.length === 0) {
      return res.json({
        success: true,
        analytics: [],
        message: 'No active modules in testing or live',
        summary: {
          total_modules: 0,
          avg_score: 0,
          ready_to_promote: 0,
          needs_improvement: 0,
          to_archive: 0
        }
      });
    }
    
    console.log(`✅ Encontrados ${activeModules.length} módulos activos`);
    
    // ✅ 2. Calcular analytics para cada módulo (LEFT JOIN implícito)
    // Si no hay tracking_events, retorna métricas en 0
    const analyticsPromises = activeModules.map(module => 
      calculateModuleAnalytics(module.key, period)
    );
    
    const analytics = (await Promise.all(analyticsPromises)).filter(Boolean);
    
    // 3. Ordenar por health score descendente
    analytics.sort((a, b) => b.healthScore - a.healthScore);
    
    const avgScore = analytics.length > 0
      ? Math.round(analytics.reduce((sum, a) => sum + a.healthScore, 0) / analytics.length)
      : 0;
    
    res.json({
      success: true,
      analytics,
      summary: {
        total_modules: analytics.length,
        avg_score: avgScore,
        ready_to_promote: analytics.filter(a => a.recommendation.action === 'validate').length,
        needs_improvement: analytics.filter(a => a.recommendation.action === 'continue').length,
        to_archive: analytics.filter(a => a.recommendation.action === 'archive').length
      }
    });
  } catch (error) {
    console.error('❌ Error getting all analytics:', error);
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
    
    // 🎯 Auto-calcular concept_name (remover sufijos de fase)
    let conceptName = moduleKey;
    if (moduleKey.endsWith('-landing')) {
      conceptName = moduleKey.replace('-landing', '');
    } else if (moduleKey.endsWith('-wizard')) {
      conceptName = moduleKey.replace('-wizard', '');
    }
    
    // 4. Crear módulo con datos del MVP
    const module = await Module.create({
      key: moduleKey,
      name: capitalize(moduleKey.replace(/-/g, ' ')),
      description: `Validated MVP - ${analytics.totalSessions} sessions, ${analytics.healthScore} score`,
      type: 'saas',
      concept_name: conceptName, // 🆕 Auto-asignado
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
 * Ejecutar decisión sobre un MVP (continue/archive/validate)
 * 
 * ✅ CORRECCIÓN: 'validate' cambia status del módulo a 'live'
 * No crea un nuevo módulo - el módulo ya existe con status='testing'
 */
export const executeMVPDecision = async (req, res) => {
  try {
    const { moduleKey } = req.params;
    const { action, reason } = req.body;
    
    if (!['continue', 'archive', 'validate'].includes(action)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid action. Must be: continue, archive, or validate'
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
      case 'validate':
        // ✅ Cambiar status a 'live' (validar módulo)
        await Module.update(
          { 
            status: 'live',
            launched_at: new Date()
          },
          { where: { key: moduleKey } }
        );
        result = { validated: true, status: 'live', reason };
        console.log(`✅ Módulo ${moduleKey} validado - status cambiado a 'live'`);
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
 * 
 * ✅ CORRECCIÓN: Retorna métricas en 0 si no hay tracking_events
 * No retorna null - un módulo sin tracking sigue siendo válido
 * 
 * ✅ FASE 2: Filtra eventos internos (source='admin') para métricas públicas limpias
 */
async function calculateModuleAnalytics(moduleKey, period = '30d') {
  const dateFrom = getDateFromPeriod(period);
  const dateTo = new Date();
  
  // 1. Buscar información del módulo en la DB
  const module = await Module.findOne({
    where: { key: moduleKey },
    attributes: ['id', 'key', 'name', 'status', 'module_type', 'concept_name', 'phase_order', 'parent_module_id', 'launched_at', 'validation_days', 'validation_target_sales']
  });

  // Determinar tipo de validación: 'landing' (dolor/demanda) o 'wizard' (solución)
  const moduleType = module?.module_type || 'wizard';
  
  // 2. Obtener eventos de tracking del módulo
  // ✅ FILTRO CRÍTICO: Excluir tracking interno (admin, internal)
  // ✅ FILTRO CRÍTICO: Excluir bots/crawlers por user_agent
  // Solo contar eventos públicos de usuarios reales para métricas limpias
  const events = await TrackingEvent.findAll({
    where: {
      module: moduleKey,
      timestamp: { [Op.gte]: dateFrom },
      source: { [Op.notIn]: ['admin', 'internal'] },  // ✅ Solo tracking público
      // 🔧 FIX #3: Filtrar bots por user_agent
      [Op.or]: [
        { user_agent: null },  // Mantener eventos sin user_agent (casos edge)
        {
          [Op.and]: [
            { user_agent: { [Op.notLike]: '%bot%' } },
            { user_agent: { [Op.notLike]: '%Bot%' } },
            { user_agent: { [Op.notLike]: '%crawler%' } },
            { user_agent: { [Op.notLike]: '%Crawler%' } },
            { user_agent: { [Op.notLike]: '%spider%' } },
            { user_agent: { [Op.notLike]: '%Spider%' } },
            { user_agent: { [Op.notLike]: '%Googlebot%' } },
            { user_agent: { [Op.notLike]: '%bingbot%' } },
            { user_agent: { [Op.notLike]: '%slurp%' } },
            { user_agent: { [Op.notLike]: '%crawl%' } }
          ]
        }
      ]
    },
    order: [['timestamp', 'ASC']]
  });
  
  // ✅ 3. Si no hay eventos públicos, retornar métricas en 0 (no null)
  if (events.length === 0) {
    console.log(`⚠️  Módulo ${moduleKey}: sin tracking events, retornando métricas en 0`);
    
    return {
      moduleKey,
      moduleId: module?.id || null,                      // 🆕 Module ID for API calls
      moduleName: module?.name || capitalize(moduleKey.replace(/-/g, ' ')),
      status: module?.status || 'draft',
      moduleType,                        // 🏗️ 'landing' | 'wizard'
      conceptName: module?.concept_name || moduleKey,  // 🆕 Concept grouping
      phaseOrder: module?.phase_order || 0,             // 🆕 Phase order (0=landing, 1=wizard, 2=live)
      parentModuleId: module?.parent_module_id || null, // 🆕 Parent module reference
      landing_metrics: null,
      totalSessions: 0,
      uniqueUsers: 0,
      wizard_starts: 0,
      wizard_completions: 0,
      downloads: 0,
      returningUsers: 0,
      total_feedback: 0,
      helpful_feedback: 0,
      feedback_rate: 0,
      helpful_rate: 0,
      organic_count: 0,
      ads_count: 0,
      conversion_rate: 0,
      download_rate: 0,
      retention_rate: 0,
      monetization_intent_count: 0,
      pro_email_submitted_count: 0,
      pro_modal_dismissed_count: 0,
      preview_to_intent_rate: 0,
      intent_to_email_rate: 0,
      healthScore: 0,
      insufficient_data: true,
      recommendation: {
        action: 'continue',
        confidence: 'low',
        reason: 'No tracking data. Needs activity to evaluate.',
        next_steps: [
          'Generate traffic to wizard/preview',
          'Share on social media',
          'Request feedback from beta users',
          'Verify that tracking is correctly implemented'
        ]
      },
      alerts: [],
      trends: {
        sessions_change: 0,
        completions_change: 0,
        downloads_change: 0,
        trend_direction: 'down'
      },
      actionCriteria: {
        can_validate: false,
        can_archive: false,
        can_continue: true,
        validation_criteria: {
          sessions_min: false,
          completions_min: false,
          feedback_min: false,
          days_min: false,
          signal_positive: false
        },
        archive_criteria: {
          sessions_min: false,
          signal_negative: false
        },
        days_running: 0,
        blocking_reasons: {
          validate: ['Not enough data to decide'],
          archive: ['Needs at least 15 sessions to confirm the pattern']
        }
      },
      period,
      date_from: dateFrom.toISOString(),
      date_to: dateTo.toISOString()
    };
  }
  
  // 2. Calcular métricas básicas
  const kpis = calculateKPIs(events, moduleType);
  
  // 3. Calcular health score
  const healthScore = calculateHealthScore(kpis, moduleType);
  
  // 4. Generar recomendación
  const recommendation = generateRecommendation(kpis, healthScore, events.length, moduleType);
  
  // 5. Generar alertas
  const alerts = generateAlerts(kpis, healthScore, events, moduleType);
  
  // 6. Calcular tendencias
  const trends = calculateTrends(events, period);
  
  // 7. Validar criterios de acciones (nuevo)
  const actionCriteria = validateActionCriteria(kpis, healthScore, events, moduleType);
  
  return {
    moduleKey,
    moduleId: module?.id || null,                      // 🆕 Module ID for API calls
    moduleName: capitalize(moduleKey.replace(/-/g, ' ')),
    status: module?.status || 'draft',
    moduleType,                        // 🏗️ 'landing' | 'wizard' | 'live'
    conceptName: module?.concept_name || moduleKey,  // 🆕 Concept grouping
    phaseOrder: module?.phase_order || 0,             // 🆕 Phase order (0=landing, 1=wizard, 2=live)
    parentModuleId: module?.parent_module_id || null, // 🆕 Parent module reference
    ...kpis,
    healthScore,
    recommendation,
    alerts,
    trends,
    actionCriteria,
    period,
    date_from: dateFrom.toISOString(),
    date_to: dateTo.toISOString()
  };
}

// ==========================================
// 🔧 FIX #2: FUNCIONES AUXILIARES PARA FILTRADO INTELIGENTE
// ==========================================

/**
 * Helper: Determinar si un evento es un "inicio" según el tipo de módulo
 * 
 * @param {Object} event - Evento de tracking
 * @param {String} moduleType - 'landing' | 'wizard'
 * @returns {Boolean}
 */
function isStartEvent(event, moduleType) {
  if (moduleType === 'landing') {
    return event.event === 'prevention_demo_viewed';
  }
  return event.event.includes('wizard_started') || event.event.includes('preview_started');
}

/**
 * Helper: Determinar si un evento es una "completion" según el tipo de módulo
 * 
 * @param {Object} event - Evento de tracking
 * @param {String} moduleType - 'landing' | 'wizard'
 * @returns {Boolean}
 */
function isCompletionEvent(event, moduleType) {
  if (moduleType === 'landing') {
    return event.event === 'waitlist_success';
  }
  
  try {
    const props = JSON.parse(event.properties || '{}');
    return (
      event.event.includes('completed') && 
      (props.step === 4 || props.completed === true)
    );
  } catch {
    return false;
  }
}

/**
 * Filtrar abandonos reales (excluir reloads rápidos)
 * 
 * Lógica: Si un wizard_abandoned es seguido de wizard_started en <10 seg
 * de la MISMA sesión, fue un reload (no un abandono real).
 * 
 * @param {Array} events - Array de tracking events ordenados por timestamp
 * @param {String} moduleKey - Identificador del módulo
 * @returns {Array} - Array de eventos wizard_abandoned REALES (sin reloads)
 */
function getRealAbandonments(events, moduleType) {
  const abandonedEvents = events.filter(e => e.event === 'wizard_abandoned');
  
  return abandonedEvents.filter(abandonEvent => {
    // Buscar eventos posteriores de la misma sesión
    const sessionEvents = events.filter(e => 
      e.session_id === abandonEvent.session_id &&
      new Date(e.timestamp) > new Date(abandonEvent.timestamp)
    );
    
    // Verificar si hay wizard_started dentro de los siguientes 10 segundos usando helper
    const hasReloadAfter = sessionEvents.some(e => {
      const isStart = isStartEvent(e, moduleType);
      const timeDiff = new Date(e.timestamp) - new Date(abandonEvent.timestamp);
      const isWithin10Sec = timeDiff < 10000; // 10 segundos en ms
      
      return isStart && isWithin10Sec;
    });
    
    // Solo contar como abandono real si NO hubo reload inmediato
    return !hasReloadAfter;
  });
}

/**
 * Detectar sesiones con múltiples wizard_starts (UX issue indicator)
 * 
 * Si un usuario reload el wizard 3+ veces, puede indicar:
 * - Confusión con la UX
 * - Errores técnicos
 * - Expectativas no cumplidas
 * 
 * @param {Array} events - Array de tracking events
 * @param {String} moduleKey - Identificador del módulo
 * @returns {Object} - { count: número de sesiones afectadas, maxReloads: máximo de reloads }
 */
function detectMultipleStarts(events, moduleType) {
  const wizardStartEvents = events.filter(e => isStartEvent(e, moduleType));
  
  // Agrupar por sesión
  const startsBySession = {};
  wizardStartEvents.forEach(e => {
    if (e.session_id) {
      startsBySession[e.session_id] = (startsBySession[e.session_id] || 0) + 1;
    }
  });
  
  // Contar sesiones con 3+ starts (threshold para UX issue)
  const sessionsWithMultipleStarts = Object.entries(startsBySession)
    .filter(([sessionId, count]) => count >= 3);
  
  const maxReloads = sessionsWithMultipleStarts.length > 0
    ? Math.max(...sessionsWithMultipleStarts.map(([_, count]) => count))
    : 0;
  
  return {
    count: sessionsWithMultipleStarts.length,
    maxReloads,
    sessions: sessionsWithMultipleStarts.map(([sessionId, count]) => ({
      session_id: sessionId,
      reload_count: count
    }))
  };
}

/**
 * Calcular KPIs de eventos
 */
function calculateKPIs(events, moduleType) {
  // Sesiones únicas (filtrar nulls/undefined)
  const sessionIds = events.map(e => e.session_id).filter(Boolean);
  const uniqueSessions = sessionIds.length > 0 ? new Set(sessionIds).size : 0;
  
  // 🔧 FIX #1: Usuarios únicos = sesiones únicas para tráfico anónimo
  // IMPORTANTE: user_id solo se llena cuando hay login (usuarios autenticados)
  // Para MVPs con tráfico público/anónimo, session_id es el identificador correcto
  // Cada session_id = 1 usuario único (aunque no esté autenticado)
  const userIds = events.map(e => e.user_id).filter(Boolean);
  const uniqueUsers = uniqueSessions;
  
  // 🔧 FIX #1: Deduplicar wizard_starts por sesión (eliminar reloads)
  // En vez de contar eventos, contar sesiones únicas que iniciaron wizard
  // Usar helper isStartEvent para reconocer diferentes tipos de módulos
  const wizardStartEvents = events.filter(e => isStartEvent(e, moduleType));
  const uniqueWizardStarts = new Set(
    wizardStartEvents.map(e => e.session_id).filter(Boolean)
  ).size;
  const wizardStarts = uniqueWizardStarts || wizardStartEvents.length; // Fallback si no hay session_id
  
  // Usar helper isCompletionEvent para reconocer diferentes tipos de módulos
  const wizardCompletions = events.filter(e => isCompletionEvent(e, moduleType)).length;
  
  // ✅ Downloads: solo eventos explícitos de descarga (NO contar 'generated')
  const downloads = events.filter(e => 
    e.event.includes('download') && !e.event.includes('generated')
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
  
  // === MONETIZATION METRICS (Nuevo: Feb 2026) ===
  const monetizationIntentEvents = events.filter(e => 
    e.event === 'monetization_intent_clicked'
  );
  
  const proEmailSubmittedEvents = events.filter(e => 
    e.event === 'pro_email_submitted'
  );
  
  const proModalDismissedEvents = events.filter(e => 
    e.event === 'pro_modal_dismissed'
  );
  
  // Tasa de conversión monetización: preview → intent
  const preview_to_intent_rate = wizardCompletions > 0
    ? Math.round((monetizationIntentEvents.length / wizardCompletions) * 100)
    : 0;
  
  // Tasa de conversión monetización: intent → email
  const intent_to_email_rate = monetizationIntentEvents.length > 0
    ? Math.round((proEmailSubmittedEvents.length / monetizationIntentEvents.length) * 100)
    : 0;
  
  // Tasa de dismissal sin email
  const modal_dismissal_rate = monetizationIntentEvents.length > 0
    ? Math.round((proModalDismissedEvents.length / monetizationIntentEvents.length) * 100)
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
  
  // 🔧 FIX #2: Filtrar wizard_abandoned con reload inmediato (<10 seg)
  const realAbandonments = getRealAbandonments(events, moduleType);
  
  // 🔧 FIX #3: Detectar sesiones con múltiples wizard_starts (UX issue)
  const sessionsWithMultipleStarts = detectMultipleStarts(events, moduleType);
  
  // Flag de datos insuficientes
  // ✅ FIX: Module-aware — landing pages no tienen feedback_submitted,
  // no castigar por ausencia de una métrica que no aplica al flujo.
  let insufficient_data;
  if (moduleType === 'landing') {
    // Landing page: solo validar sesiones y vistas (no feedback)
    insufficient_data = uniqueSessions < 5 || wizardStarts < 3;
  } else {
    // Wizards normales: requieren feedback
    insufficient_data = (
      uniqueSessions < 5 ||
      wizardStarts < 3 ||
      feedbackEvents.length < 3
    );
  }
  
  // === LANDING METRICS (only for module_type='landing') ===
  // Extraer métricas especializadas para prototipos/landing de validación de dolor
  let landing_metrics = null;
  if (moduleType === 'landing') {
    const metricClickEvents = events.filter(e => e.event === 'metric_clicked');
    const waitlistSignups = events.filter(e => e.event === 'waitlist_success').length;
    const demoViews = wizardStartEvents.length; // prevention_demo_viewed

    // 🔧 FIX: Engagement Rate = % de usuarios que hicieron al menos 1 click (max 100%)
    // No debe ser total_clicks/views porque eso puede superar 100%
    const uniqueSessionsWithClicks = new Set(
      metricClickEvents.map(e => e.session_id).filter(Boolean)
    ).size;
    
    const engagement_rate = demoViews > 0 
      ? Math.round((uniqueSessionsWithClicks / demoViews) * 100) 
      : 0;
    
    // Métrica adicional: promedio de clicks por usuario (puede ser > 1)
    const avg_clicks_per_view = demoViews > 0 
      ? Math.round((metricClickEvents.length / demoViews) * 10) / 10 // 1 decimal
      : 0;

    // Mapa de puntos de dolor: cuáles métricas resonaron más
    const painPointMap = {};
    metricClickEvents.forEach(e => {
      try {
        const props = typeof e.properties === 'string' ? JSON.parse(e.properties) : e.properties;
        const metric = props?.metric;
        if (metric) painPointMap[metric] = (painPointMap[metric] || 0) + 1;
      } catch {}
    });

    const top_pain_points = Object.entries(painPointMap)
      .map(([metric, clicks]) => ({ metric, clicks }))
      .sort((a, b) => b.clicks - a.clicks);

    landing_metrics = {
      demo_views:          demoViews,
      engagement_clicks:   metricClickEvents.length,
      engagement_rate,     // % de usuarios que hicieron al menos 1 click (max 100%)
      avg_clicks_per_view, // Promedio de pain points explorados por usuario
      waitlist_signups:    waitlistSignups,
      waitlist_conversion: demoViews > 0 ? Math.round((waitlistSignups / demoViews) * 100) : 0,
      top_pain_points
    };
  }

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
    // === MONETIZATION METRICS ===
    monetization_intent_count: monetizationIntentEvents.length,
    pro_email_submitted_count: proEmailSubmittedEvents.length,
    pro_modal_dismissed_count: proModalDismissedEvents.length,
    preview_to_intent_rate,
    intent_to_email_rate,
    modal_dismissal_rate,
    // Metadata adicional para debug
    _meta: {
      total_events: events.length,
      events_with_session_id: sessionIds.length,
      events_with_user_id: userIds.length,
      unique_identifiers: Object.keys(sessionsByUser).length,
      // 🔧 FIX #3: Métricas de calidad de datos
      raw_wizard_starts: wizardStartEvents.length,
      unique_wizard_starts: uniqueWizardStarts,
      reload_events_filtered: wizardStartEvents.length - uniqueWizardStarts,
      total_abandonments: events.filter(e => e.event === 'wizard_abandoned').length,
      real_abandonments: realAbandonments.length,
      false_positive_abandonments: events.filter(e => e.event === 'wizard_abandoned').length - realAbandonments.length,
      sessions_with_multiple_starts: sessionsWithMultipleStarts.count,
      confused_user_rate: uniqueSessions > 0 ? Math.round((sessionsWithMultipleStarts.count / uniqueSessions) * 100) : 0,
      data_confidence: uniqueSessions >= 30 ? 'high' : uniqueSessions >= 10 ? 'medium' : 'low'
    },
    // Exponer abandonos reales para uso en alerts
    _abandonments: realAbandonments,
    _sessions_multiple_starts: sessionsWithMultipleStarts,
    // 🏗️ Landing-specific metrics (null para wizard modules)
    landing_metrics
  };
}

/**
 * Calcular Health Score (0-100)
 * Con penalización por datos insuficientes
 *
 * ✅ FIX: Fórmula separada para landing pages (inbox-zero-prevention)
 * Las landing pages no tienen wizard completions ni feedback_submitted.
 * Se evalúan por: volumen de visitas + tasa de conversión a waitlist.
 */
function calculateHealthScore(kpis, moduleType = 'wizard') {

  // Landing page formula
  if (moduleType === 'landing') {
    // volume_score: 100 pts cuando hay 20+ sesiones reales
    const volume_score = Math.min((kpis.totalSessions / 20) * 100, 100);
    // conversion_score: tasa waitlist_success / prevention_demo_viewed (0-100)
    const conversion_score = kpis.conversion_rate;

    const rawScore = Math.round(
      (volume_score    * 0.60) +   // 60% — cantidad de visitantes
      (conversion_score * 0.40)    // 40% — conversión a waitlist
    );

    if (kpis.insufficient_data) {
      // Cap 50 hasta tener suficientes datos
      return Math.max(0, Math.min(50, rawScore));
    }
    return Math.max(0, Math.min(100, rawScore));
  }

  // ── Generic wizard formula (unchanged) ───────────────────────────────────
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
function generateRecommendation(kpis, healthScore, totalEvents, moduleType = 'wizard') {
  const { 
    create_module_score,
    create_module_downloads,
    create_module_feedback_rate,
    archive_score,
    archive_min_sessions,
    min_sessions_to_analyze
  } = DECISION_THRESHOLDS;

  // Landing page (pain/demand validation)
  if (moduleType === 'landing') {
    if (kpis.insufficient_data) {
      return {
        action: 'continue',
        confidence: 'low',
        reason: `Few visits yet (${kpis.totalSessions} sessions). Score: ${healthScore}. Needs more real traffic to evaluate.`,
        next_steps: [
          'Share the landing on Discord, Reddit and Twitter',
          'Request at least 20 real visits before evaluating',
          'Verify that tracking fires on every visit'
        ]
      };
    }
    // With sufficient data: evaluate by waitlist conversion
    if (kpis.wizard_completions > 0) {
      return {
        action: 'validate',
        confidence: 'high',
        reason: `${kpis.wizard_completions} waitlist signup(s) from ${kpis.totalSessions} visits. Positive signal of real demand.`,
        next_steps: [
          'Onboard first users',
          'Validate willingness to pay',
          'Scale distribution'
        ]
      };
    }
    return {
      action: 'continue',
      confidence: 'low',
      reason: `${kpis.totalSessions} visits, 0 waitlist conversions. Score ${healthScore}. Optimize CTA and checkout.`,
      next_steps: [
        'Check if "Join Waitlist" button is visible on mobile',
        'Add more strength to CTA (urgency / concrete benefit)',
        'Increase organic traffic volume'
      ]
    };
  }
  
  // PRIORITY CASE: Insufficient data
  if (kpis.insufficient_data) {
    return {
      action: 'continue',
      confidence: 'low',
      reason: `Insufficient data to decide. Only ${kpis.totalSessions} sessions, ${kpis.total_feedback} feedbacks. Score: ${healthScore} (penalized by low data).`,
      next_steps: [
        'Continue collecting data (min: 5 sessions, 3 feedbacks)',
        'Promote MVP on social media',
        'Request direct user feedback',
        'Review session_id tracking'
      ]
    };
  }
  
  // Case 1: Validate and activate module (change status to 'live')
  if (
    healthScore >= create_module_score &&
    kpis.downloads >= create_module_downloads &&
    kpis.helpful_rate >= create_module_feedback_rate
  ) {
    return {
      action: 'validate',
      confidence: 'high',
      reason: `Excellent performance: Score ${healthScore}, ${kpis.downloads} downloads, ${kpis.helpful_rate}% positive feedback`,
      next_steps: [
        'Validate module (change status to "live")',
        'Configure pricing and plans',
        'Prepare documentation',
        'Promote publicly'
      ]
    };
  }
  
  // Case 2: Archive
  if (
    kpis.totalSessions >= archive_min_sessions &&
    healthScore < archive_score
  ) {
    return {
      action: 'archive',
      confidence: 'medium',
      reason: `Low score (${healthScore}) after ${kpis.totalSessions} sessions. Did not validate user pain.`,
      next_steps: [
        'Archive MVP',
        'Analyze negative feedback',
        'Consider pivot or new MVP'
      ]
    };
  }
  
  // Case 3: Needs specific improvements
  if (kpis.conversion_rate < 50) {
    return {
      action: 'continue',
      confidence: 'low',
      reason: `Low conversion (${kpis.conversion_rate}%). Improve wizard UX.`,
      next_steps: [
        'Analyze abandonment by step',
        'Simplify forms',
        'Add contextual help'
      ]
    };
  }
  
  if (kpis.helpful_rate < 60 && kpis.total_feedback > 5) {
    return {
      action: 'continue',
      confidence: 'low',
      reason: `High negative feedback (${100 - kpis.helpful_rate}%). Improve output quality.`,
      next_steps: [
        'Review negative feedback',
        'Improve generator algorithm',
        'Adjust user expectations'
      ]
    };
  }
  
  // Case 4: Continue validating (default)
  if (kpis.totalSessions < min_sessions_to_analyze) {
    return {
      action: 'continue',
      confidence: 'low',
      reason: `Few sessions (${kpis.totalSessions}). Needs more data to decide.`,
      next_steps: [
        'Continue validating',
        'Promote on social media',
        'Request direct feedback'
      ]
    };
  }
  
  return {
    action: 'continue',
    confidence: 'medium',
    reason: `In validation. Score: ${healthScore}. Improve metrics before deciding.`,
    next_steps: [
      'Increase volume',
      'Improve feedback rate',
      'Optimize conversion'
    ]
  };
}

/**
 * Validar criterios de acciones del motor
 * Determina qué acciones están habilitadas y por qué
 */
function validateActionCriteria(kpis, healthScore, events, moduleType = 'wizard') {
  const daysRunning = calculateDaysRunning(events);

  // Landing page (pain/demand validation)
  if (moduleType === 'landing') {
    const validationCriteria = {
      sessions_min:    kpis.totalSessions >= 20,
      completions_min: kpis.wizard_completions >= 1,   // waitlist_success
      feedback_min:    true,                            // no aplica — siempre OK
      days_min:        daysRunning >= 3,
      signal_positive: kpis.wizard_completions >= 1 || kpis.conversion_rate >= 5
    };

    const archiveCriteria = {
      sessions_min:     kpis.totalSessions >= 20,
      signal_negative:  kpis.wizard_completions === 0 && kpis.totalSessions >= 20
    };

    const canValidate = Object.values(validationCriteria).every(v => v === true);
    const canArchive  = Object.values(archiveCriteria).every(v => v === true);

    return {
      can_validate: canValidate,
      can_archive:  canArchive,
      can_continue: true,
      validation_criteria: validationCriteria,
      archive_criteria:    archiveCriteria,
      days_running:        daysRunning,
      blocking_reasons: {
        validate: !canValidate ? getBlockingReasons(validationCriteria, 'validate') : [],
        archive:  !canArchive  ? getBlockingReasons(archiveCriteria, 'archive')  : []
      }
    };
  }
  
  // 🟢 Criterios para VALIDAR MÓDULO (cambiar status a 'live')
  const validationCriteria = {
    sessions_min: kpis.totalSessions >= 20,
    completions_min: kpis.wizard_completions >= 5,
    feedback_min: kpis.total_feedback >= 5,
    days_min: daysRunning >= 3,
    // Al menos una señal positiva fuerte
    signal_positive: (
      kpis.conversion_rate >= 15 ||
      kpis.helpful_rate >= 60 ||
      kpis.retention_rate >= 20
    )
  };
  
  const canValidate = Object.values(validationCriteria).every(v => v === true);
  
  // 🔴 Criterios para ARCHIVAR
  const archiveCriteria = {
    sessions_min: kpis.totalSessions >= 15,
    // Al menos una señal negativa clara
    signal_negative: (
      (kpis.wizard_completions === 0 && kpis.wizard_starts >= 10) ||
      (kpis.helpful_rate < 30 && kpis.total_feedback >= 5) ||
      (healthScore < 40 && kpis.totalSessions >= 20)
    )
  };
  
  const canArchive = Object.values(archiveCriteria).every(v => v === true);
  
  // ⏸️ CONTINUAR siempre disponible
  const canContinue = true;
  
  return {
    can_validate: canValidate,
    can_archive: canArchive,
    can_continue: canContinue,
    validation_criteria: validationCriteria,
    archive_criteria: archiveCriteria,
    days_running: daysRunning,
    blocking_reasons: {
      validate: !canValidate ? getBlockingReasons(validationCriteria, 'validate') : [],
      archive: !canArchive ? getBlockingReasons(archiveCriteria, 'archive') : []
    }
  };
}

/**
 * Calcular días desde el primer evento
 */
function calculateDaysRunning(events) {
  if (events.length === 0) return 0;
  
  const firstEventDate = new Date(events[0].timestamp);
  const now = new Date();
  const diffMs = now - firstEventDate;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  return diffDays;
}

/**
 * Obtener razones específicas del bloqueo
 */
function getBlockingReasons(criteria, actionType) {
  const reasons = [];
  
  if (actionType === 'validate') {
    if (!criteria.sessions_min) reasons.push('Minimum 20 sessions required');
    if (!criteria.completions_min) reasons.push('Minimum 5 wizard completions required');
    if (!criteria.feedback_min) reasons.push('Minimum 5 feedbacks required');
    if (!criteria.days_min) reasons.push('Minimum 3 validation days required');
    if (!criteria.signal_positive) reasons.push('Needs at least one strong positive signal (conversion ≥15% or feedback ≥60% or retention ≥20%)');
  }
  
  if (actionType === 'archive') {
    if (!criteria.sessions_min) reasons.push('Needs at least 15 sessions to confirm the pattern');
    if (!criteria.signal_negative) reasons.push('No clear negative signal strong enough to archive');
  }
  
  return reasons;
}

/**
 * Generar alertas inteligentes
 */
function generateAlerts(kpis, healthScore, events, moduleType = 'wizard') {
  const alerts = [];
  
  // 🚨 Alert PRIORITARIO: Datos insuficientes
  if (kpis.insufficient_data) {
    const missingData = [];
    if (kpis.totalSessions < 5) missingData.push(`${kpis.totalSessions} sessions (min: 5)`);
    if (kpis.wizard_starts < 3) missingData.push(`${kpis.wizard_starts} wizard starts (min: 3)`);
    // Para landing: validar waitlist signups en lugar de feedbacks
    if (moduleType === 'landing') {
      const signups = kpis.landing_metrics?.waitlist_signups ?? 0;
      if (signups < 3) missingData.push(`${signups} waitlist signups (min: 3)`);
    } else {
      if (kpis.total_feedback < 3) missingData.push(`${kpis.total_feedback} feedbacks (min: 3)`);
    }
    
    alerts.push({
      type: 'warning',
      title: '📊 Insufficient Data',
      message: `MVP with low data: ${missingData.join(', ')}. KPIs may not be representative.`,
      action: 'collect_more_data',
      priority: 'high'
    });
  }
  
  // 🔧 FIX #4: Alert UX Issue - Usuarios reloading wizard múltiples veces
  if (kpis._sessions_multiple_starts && kpis._sessions_multiple_starts.count > 0) {
    const confusedRate = kpis._meta.confused_user_rate;
    if (confusedRate >= 15) { // >15% usuarios confundidos
      alerts.push({
        type: 'warning',
        title: '🔄 UX Issue Detected',
        message: `${kpis._sessions_multiple_starts.count} users (${confusedRate}%) reloaded wizard ${kpis._sessions_multiple_starts.maxReloads}+ times. Possible UX confusion or technical errors.`,
        action: 'review_wizard_ux',
        priority: 'high'
      });
    } else if (confusedRate >= 5) {
      alerts.push({
        type: 'info',
        title: '🔄 Multiple Reloads Detected',
        message: `${kpis._sessions_multiple_starts.count} users (${confusedRate}%) reloaded wizard multiple times. Monitor UX.`,
        action: 'monitor_ux',
        priority: 'medium'
      });
    }
  }
  
  // ⚠️ Alert: Inconsistent metrics (wizard starts > sessions)
  if (kpis.wizard_starts > kpis.totalSessions * 3) {
    alerts.push({
      type: 'info',
      title: '⚠️ Inconsistent Metric',
      message: `${kpis.wizard_starts} wizard starts vs ${kpis.totalSessions} sessions. Check session_id tracking.`,
      action: 'check_tracking',
      priority: 'medium'
    });
  }
  
  // ✅ Alert: Ready to validate (change to 'live')
  if (
    !kpis.insufficient_data &&
    healthScore >= DECISION_THRESHOLDS.create_module_score &&
    kpis.downloads >= DECISION_THRESHOLDS.create_module_downloads
  ) {
    alerts.push({
      type: 'success',
      title: '🎉 MVP Validated',
      message: `Ready to validate and activate! Score ${healthScore}, ${kpis.downloads} downloads.`,
      action: 'validate',
      priority: 'high'
    });
  }
  
  // ⚠️ Alert: Low conversion
  if (kpis.conversion_rate < 50 && kpis.wizard_starts >= 20) {
    alerts.push({
      type: 'warning',
      title: '⚠️ Low Conversion',
      message: `Only ${kpis.conversion_rate}% complete the wizard. Review UX.`,
      action: 'improve_ux',
      priority: 'medium'
    });
  }
  
  // ⚠️ Alert: High negative feedback
  if (kpis.helpful_rate < 60 && kpis.total_feedback >= 10) {
    alerts.push({
      type: 'warning',
      title: '😞 High Negative Feedback',
      message: `${100 - kpis.helpful_rate}% negative feedback. Improve quality.`,
      action: 'improve_quality',
      priority: 'high'
    });
  }
  
  // 🔥 Alert: High demand
  if (kpis.totalSessions > 100 && events.length > 500) {
    alerts.push({
      type: 'info',
      title: '🔥 High Demand',
      message: `${kpis.totalSessions} sessions. Big market interest.`,
      action: 'scale_up',
      priority: 'low'
    });
  }
  
  // ℹ️ Alert: Low downloads
  if (kpis.download_rate < 50 && kpis.wizard_completions >= 20) {
    alerts.push({
      type: 'info',
      title: 'ℹ️ Low Downloads',
      message: `Only ${kpis.download_rate}% download. Add more visible CTA.`,
      action: 'improve_cta',
      priority: 'low'
    });
  }
  
  // ❌ Alert: Few sessions (only if no insufficient_data alert)
  if (!kpis.insufficient_data && kpis.totalSessions < DECISION_THRESHOLDS.min_sessions_to_analyze) {
    alerts.push({
      type: 'info',
      title: '📊 Needs More Data',
      message: `Only ${kpis.totalSessions} sessions. Promote more.`,
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
