import { TrackingEvent } from '../../../models/TrackingEvent.js';
import { Module } from '../../../domains/platform/models/Module.js';
import { Op } from 'sequelize';

import { calculateKPIs } from './services/mvp-kpis.service.js';
import { calculateHealthScore } from './services/mvp-health-score.service.js';
import { generateRecommendation } from './services/mvp-recommendation.service.js';
import { DECISION_THRESHOLDS } from './config/mvp-analytics.config.js';


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
  // 🐛 DEBUG: Verificar que este código se está ejecutando
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('🔍 BOT FILTER ACTIVE - calculateModuleAnalytics()');
  console.log(`   Module: ${moduleKey}`);
  console.log(`   Period: ${period}`);
  console.log('═══════════════════════════════════════════════════════');
  
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
      // IMPORTANTE: Incluir eventos con user_agent NULL (usuarios legítimos sin UA)
      // SQL: (user_agent IS NULL) OR (user_agent NOT LIKE bot patterns)
      [Op.or]: [
        { user_agent: null },  // Incluir NULL = usuarios legítimos
        { 
          user_agent: {
            [Op.and]: [
              { [Op.notLike]: '%Googlebot%' },
              { [Op.notLike]: '%googlebot%' },
              { [Op.notLike]: '%bingbot%' },
              { [Op.notLike]: '%bot/%' },
              { [Op.notLike]: '%crawler%' },
              { [Op.notLike]: '%Crawler%' },
              { [Op.notLike]: '%spider%' },
              { [Op.notLike]: '%Spider%' },
              { [Op.notLike]: '%slurp%' },
              { [Op.notLike]: '%crawl%' }
            ]
          }
        }
      ]
    },
    order: [['timestamp', 'ASC']]
  });
  
  // 🐛 DEBUG: Log bot filter results
  const uniqueSessionsInEvents = new Set(events.map(e => e.session_id).filter(Boolean)).size;
  console.log('');
  console.log('📊 Query Results:');
  console.log(`   - Total events returned: ${events.length}`);
  console.log(`   - Unique sessions: ${uniqueSessionsInEvents}`);
  console.log(`   - Event types: ${[...new Set(events.map(e => e.event))].join(', ')}`);
  
  // Show first 3 user agents that passed the filter
  const sampleUserAgents = events.slice(0, 3).map(e => ({
    session: e.session_id,
    ua: e.user_agent ? e.user_agent.substring(0, 80) : 'NULL'
  }));
  console.log(`   - Sample user_agents (first 3):`);
  sampleUserAgents.forEach(s => console.log(`     * ${s.session}: ${s.ua}`));
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
  
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

export {
    calculateModuleAnalytics,
    capitalize
}