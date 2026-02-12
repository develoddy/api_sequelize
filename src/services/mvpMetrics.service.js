/**
 * MVP Metrics Service
 * 
 * Calcula señales reales de tracción para cada MVP.
 * Define qué hace que un MVP esté "vivo" y merezca aparecer en /.
 * 
 * Principio: Solo mostramos MVPs con pulso real, no módulos técnicos.
 * 
 * @module services/mvpMetrics
 */

import { TrackingEvent } from '../models/TrackingEvent.js';
import { VideoJob } from '../models/VideoJob.js';
import { Tenant } from '../models/Tenant.js';
import { Module } from '../models/Module.js';
import { Op } from 'sequelize';
import { sequelize } from '../database/database.js';

/**
 * Señales reales que indican que un MVP está vivo
 */
const MVP_HEALTH_SIGNALS = {
  // Mínimo de actividad en últimos 30 días
  MIN_RECENT_SESSIONS: 3,
  MIN_PREVIEW_USES: 5,
  MIN_WIZARD_COMPLETIONS: 1,
  
  // Ventana temporal
  DAYS_LOOKBACK: 30
};

/**
 * Tipos de MVPs excluidos del Hub público
 */
const EXCLUDED_MVP_TYPES = [
  'demo',           // Demos técnicas (KeyModule)
  'internal-tool',  // Herramientas internas
  'template'        // Plantillas base
];

/**
 * Keys específicas excluidas explícitamente
 */
const EXCLUDED_MVP_KEYS = [
  'key-module'  // Demo técnica, nunca debe aparecer en /
];

/**
 * Calcular métricas de un MVP específico
 * 
 * @param {string} moduleKey - Key del módulo (ej: 'video-express')
 * @returns {Object} - Métricas calculadas
 */
async function calculateMvpMetrics(moduleKey) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - MVP_HEALTH_SIGNALS.DAYS_LOOKBACK);

  try {
    // 1. Sesiones recientes (eventos de tracking)
    const recentSessions = await TrackingEvent.count({
      where: {
        module: moduleKey,
        timestamp: { [Op.gte]: thirtyDaysAgo }
      },
      distinct: true,
      col: 'session_id'
    });

    // 2. Usos de preview (tracking events)
    const previewUses = await TrackingEvent.count({
      where: {
        module: moduleKey,
        event: { [Op.like]: '%preview%' },
        timestamp: { [Op.gte]: thirtyDaysAgo }
      }
    });

    // 3. Completions del wizard
    const wizardCompletions = await TrackingEvent.count({
      where: {
        module: moduleKey,
        event: 'wizard_completed',
        timestamp: { [Op.gte]: thirtyDaysAgo }
      }
    });

    // 4. Feedback positivo
    const positiveFeedback = await TrackingEvent.count({
      where: {
        module: moduleKey,
        event: 'feedback_submitted',
        properties: { [Op.like]: '%"positive":true%' },
        timestamp: { [Op.gte]: thirtyDaysAgo }
      }
    });

    // 5. Tenants activos (DESHABILITADO - Ya no se usa modules/tenants en fase MVP)
    // Solo se activa después de validar y promocionar a módulo oficial
    const activeTenants = 0;
    
    // NOTA: En fase MVP, todas las métricas vienen de tracking_events
    // La tabla tenants solo se usa después de ejecutar "Create Module" en Admin Panel

    // 6. Métricas específicas por MVP
    let specificMetrics = {};
    
    if (moduleKey === 'video-express') {
      // Videos generados recientemente
      const [videoStats] = await sequelize.query(`
        SELECT 
          COUNT(*) as total_jobs,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_jobs,
          SUM(CASE WHEN is_preview = 1 THEN 1 ELSE 0 END) as preview_jobs
        FROM video_jobs
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL ${MVP_HEALTH_SIGNALS.DAYS_LOOKBACK} DAY)
      `);
      
      specificMetrics = {
        totalJobs: videoStats[0]?.total_jobs || 0,
        completedJobs: videoStats[0]?.completed_jobs || 0,
        previewJobs: videoStats[0]?.preview_jobs || 0
      };
    }

    // 7. Calcular health score (0-100)
    const healthScore = calculateHealthScore({
      recentSessions,
      previewUses,
      wizardCompletions,
      positiveFeedback,
      activeTenants,
      ...specificMetrics
    });

    return {
      moduleKey,
      metrics: {
        recentSessions,
        previewUses,
        wizardCompletions,
        positiveFeedback,
        activeTenants,
        ...specificMetrics
      },
      healthScore,
      isAlive: healthScore > 0,
      lastCalculated: new Date()
    };

  } catch (error) {
    console.error(`❌ Error calculando métricas para ${moduleKey}:`, error);
    return {
      moduleKey,
      metrics: {},
      healthScore: 0,
      isAlive: false,
      error: error.message
    };
  }
}

/**
 * Calcular health score basado en señales reales
 * 
 * @param {Object} signals - Señales de uso
 * @returns {number} - Score de 0 a 100
 */
function calculateHealthScore(signals) {
  let score = 0;

  // Sesiones recientes (40 puntos máx)
  if (signals.recentSessions >= MVP_HEALTH_SIGNALS.MIN_RECENT_SESSIONS) {
    score += Math.min(40, signals.recentSessions * 5);
  }

  // Preview usage (30 puntos máx)
  if (signals.previewUses >= MVP_HEALTH_SIGNALS.MIN_PREVIEW_USES) {
    score += Math.min(30, signals.previewUses * 3);
  }

  // Wizard completions (20 puntos máx)
  if (signals.wizardCompletions >= MVP_HEALTH_SIGNALS.MIN_WIZARD_COMPLETIONS) {
    score += Math.min(20, signals.wizardCompletions * 10);
  }

  // Feedback positivo (10 puntos máx)
  score += Math.min(10, signals.positiveFeedback * 5);

  // Tenants activos (DESHABILITADO en fase MVP)
  // Solo cuenta después de promocionar a módulo oficial
  // if (signals.activeTenants > 0) {
  //   score += Math.min(20, signals.activeTenants * 5);
  // }

  return Math.min(100, score);
}

/**
 * Obtener MVPs activos con señales reales
 * Solo MVPs que tienen pulso y merecen aparecer en /
 * 
 * @returns {Array} - Lista de MVPs activos con métricas
 */
export async function getActiveMvps() {
  try {
    // 1. Obtener todos los módulos potencialmente públicos
    const modules = await Module.findAll({
      where: {
        is_active: true,
        status: { [Op.in]: ['testing', 'live'] },
        type: { [Op.notIn]: EXCLUDED_MVP_TYPES },
        key: { [Op.notIn]: EXCLUDED_MVP_KEYS }
      },
      attributes: [
        'id', 'key', 'name', 'tagline', 'description',
        'type', 'status', 'icon', 'color',
        'preview_config', 'saas_config', 'created_at'
      ]
    });

    // 2. Calcular métricas reales para cada módulo
    const mvpsWithMetrics = await Promise.all(
      modules.map(async (module) => {
        const metrics = await calculateMvpMetrics(module.key);
        
        return {
          ...module.toJSON(),
          metrics: metrics.metrics,
          healthScore: metrics.healthScore,
          isAlive: metrics.isAlive
        };
      })
    );

    // 3. Filtrar solo MVPs con señales reales (health score > 0)
    const aliveMvps = mvpsWithMetrics.filter(mvp => mvp.isAlive);

    // 4. Ordenar por health score (más tracción primero)
    aliveMvps.sort((a, b) => b.healthScore - a.healthScore);

    console.log(`✅ MVPs activos: ${aliveMvps.length}/${modules.length}`);
    console.log('📊 Ranking:', aliveMvps.map(m => `${m.key} (${m.healthScore})`).join(', '));

    return aliveMvps;

  } catch (error) {
    console.error('❌ Error obteniendo MVPs activos:', error);
    throw error;
  }
}

/**
 * Verificar si un MVP específico está vivo
 * 
 * @param {string} moduleKey - Key del módulo
 * @returns {boolean} - Si el MVP tiene señales reales
 */
export async function isMvpAlive(moduleKey) {
  const metrics = await calculateMvpMetrics(moduleKey);
  return metrics.isAlive;
}

/**
 * Obtener métricas detalladas de un MVP
 * 
 * @param {string} moduleKey - Key del módulo
 * @returns {Object} - Métricas completas
 */
export async function getMvpDetailedMetrics(moduleKey) {
  return await calculateMvpMetrics(moduleKey);
}

/**
 * Criterios para promover un MVP a módulo estable
 * 
 * @param {string} moduleKey - Key del módulo
 * @returns {Object} - { readyForPromotion: boolean, reasons: [] }
 */
export async function checkPromotionCriteria(moduleKey) {
  const metrics = await calculateMvpMetrics(moduleKey);
  
  const criteria = {
    healthScore: metrics.healthScore >= 70,
    // userAdoption: metrics.metrics.activeTenants >= 3, // DESHABILITADO - No aplica en fase MVP 10,
    userAdoption: metrics.metrics.activeTenants >= 3,
    wizardCompletion: metrics.metrics.wizardCompletions >= 5,
    positiveFeedback: metrics.metrics.positiveFeedback >= 3
  };

  const passed = Object.values(criteria).filter(Boolean).length;
  const total = Object.keys(criteria).length;
  
  const readyForPromotion = passed >= 3; // Al menos 3 de 4 criterios (sin userAdoption en MVP)

  return {
    moduleKey,
    readyForPromotion,
    score: `${passed}/${total}`,
    criteria,
    recommendation: readyForPromotion 
      ? 'Este MVP está listo para convertirse en módulo estable'
      : 'Este MVP necesita más tracción antes de promocionar'
  };
}

export default {
  getActiveMvps,
  isMvpAlive,
  getMvpDetailedMetrics,
  checkPromotionCriteria
};
