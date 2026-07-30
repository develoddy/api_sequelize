import { TrackingEvent } from '../../../models/TrackingEvent.js';
import { Module } from '../../../domains/platform/models/Module.js';
import { Op } from 'sequelize';
import { capitalize } from '../../../utils/string.utils.js';

import { calculateKPIs } from './services/mvp-kpis.service.js';
import { calculateHealthScore } from './services/mvp-health-score.service.js';
import { generateRecommendation } from './services/mvp-recommendation.service.js';
import { generateAlerts } from './services/mvp-alerts.service.js';
import { validateActionCriteria } from './services/mvp-action-criteria.service.js';

import {
  calculateTrends,
  getDateFromPeriod
} from './services/mvp-trends.service.js';

import {
  createEmptyAnalyticsResult
} from './factories/mvp-empty-analytics.factory.js';


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
    
    return createEmptyAnalyticsResult({
      moduleKey,
      module,
      moduleType,
      period,
      dateFrom,
      dateTo
    });
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


export {
    calculateModuleAnalytics
}