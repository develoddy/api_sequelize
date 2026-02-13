import { DataTypes } from 'sequelize';
import { sequelize } from '../database/database.js';

/**
 * MVP Analytics Controller
 * 
 * Extrae análisis dinámicos de micro-SaaS desde tracking_events
 * Sin requerir MVPs precargados en base de datos.
 * 
 * @author AI Assistant
 * @date 2026-02-10
 */

/**
 * @route   GET /api/mvp-analytics/all
 * @desc    Obtener listado de todos los MVPs con analytics resumidos
 * @access  Public (puede restringirse luego)
 * @query   {string} period - Período de análisis: 7d | 30d | 90d | all
 */
export const getAllMvps = async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    
    // Calcular fecha de inicio según período
    let dateFilter = '';
    if (period !== 'all') {
      const days = parseInt(period.replace('d', ''));
      dateFilter = `AND created_at >= DATE_SUB(NOW(), INTERVAL ${days} DAY)`;
    }

    // Query SQL para agregar eventos por módulo
    // 🎯 FASE 2: Solo contar eventos públicos (source='preview'), excluir tests internos (source='admin')
    const query = `
      SELECT 
        module,
        COUNT(DISTINCT session_id) as total_sessions,
        COUNT(CASE WHEN event LIKE '%wizard_started%' THEN 1 END) as wizard_starts,
        COUNT(CASE WHEN event = 'wizard_completed' THEN 1 END) as wizard_completions,
        COUNT(CASE WHEN event = 'preview_generated' THEN 1 END) as preview_generated,
        COUNT(CASE WHEN event LIKE '%feedback%' AND event NOT LIKE '%comment%' THEN 1 END) as total_feedback,
        COUNT(CASE WHEN event LIKE '%feedback%' AND JSON_EXTRACT(properties, '$.answer') = 'yes' THEN 1 END) as positive_feedback,
        MIN(created_at) as first_event,
        MAX(created_at) as last_event
      FROM tracking_events
      WHERE module IS NOT NULL 
        AND module != ''
        AND source = 'preview'
        ${dateFilter}
      GROUP BY module
      HAVING total_sessions > 0
      ORDER BY total_sessions DESC
    `;

    const [results] = await sequelize.query(query);

    // Procesar resultados y calcular métricas
    const mvps = results.map(row => {
      const conversionRate = row.wizard_starts > 0
        ? Math.round((row.wizard_completions / row.wizard_starts) * 100)
        : 0;
      
      const positiveFeedbackRate = row.total_feedback > 0
        ? Math.round((row.positive_feedback / row.total_feedback) * 100)
        : 0;

      // Health Score simple (mejorable)
      const MIN_SESSIONS = 20;
      const insufficientData = row.total_sessions < MIN_SESSIONS;
      
      let healthScore = 0;
      if (!insufficientData) {
        healthScore = Math.min(100, Math.round(
          (row.total_sessions / 100 * 30) + // 30% sesiones
          (conversionRate * 0.4) +           // 40% conversión
          (positiveFeedbackRate * 0.3)       // 30% feedback positivo
        ));
      }

      // Determinar status y recomendación
      let status = 'insufficient_data';
      let recommendation = {
        action: 'wait',
        confidence: 0,
        reasoning: `Necesita al menos ${MIN_SESSIONS} sesiones para análisis confiable`,
        icon: '⏳'
      };

      if (!insufficientData) {
        if (healthScore >= 70 && row.wizard_completions >= 10) {
          status = 'create_module';
          recommendation = {
            action: 'create_module',
            confidence: 85,
            reasoning: 'Métricas sólidas y tracción demostrable. Listo para módulo oficial.',
            icon: '🚀'
          };
        } else if (healthScore >= 50) {
          status = 'continue';
          recommendation = {
            action: 'continue',
            confidence: 70,
            reasoning: 'Señales positivas pero necesita más validación.',
            icon: '⏸️'
          };
        } else {
          status = 'archive';
          recommendation = {
            action: 'archive',
            confidence: 60,
            reasoning: 'Performance bajo expectativas. Considerar archivar o pivotar.',
            icon: '🗄️'
          };
        }
      }

      // Formatear nombre del módulo
      const moduleName = row.module
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

      return {
        module_key: row.module,
        module_name: moduleName,
        health_score: healthScore,
        status,
        total_sessions: row.total_sessions,
        wizard_starts: row.wizard_starts,
        wizard_completions: row.wizard_completions,
        total_feedback: row.total_feedback,
        conversion_rate: conversionRate,
        date_range: `${new Date(row.first_event).toLocaleDateString()} - ${new Date(row.last_event).toLocaleDateString()}`,
        recommendation,
        insufficient_data: insufficientData,
        min_required_sessions: MIN_SESSIONS
      };
    });

    res.json({
      success: true,
      mvps,
      total: mvps.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error en getAllMvps:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener analytics de MVPs',
      error: error.message
    });
  }
};

/**
 * @route   GET /api/mvp-analytics/:moduleKey
 * @desc    Obtener analytics detallados de un MVP específico
 * @access  Public
 * @params  {string} moduleKey - Slug del módulo
 * @query   {string} period - Período: 7d | 30d | 90d | all
 */
export const getMvpDetail = async (req, res) => {
  try {
    const { moduleKey } = req.params;
    const { period = '30d' } = req.query;

    // Calcular fecha de inicio
    let dateFilter = '';
    if (period !== 'all') {
      const days = parseInt(period.replace('d', ''));
      dateFilter = `AND created_at >= DATE_SUB(NOW(), INTERVAL ${days} DAY)`;
    }

    // Query detallado para un módulo específico
    // 🎯 FASE 2: Solo analizar eventos públicos (source='preview'), excluir tests internos del admin
    const query = `
      SELECT 
        COUNT(DISTINCT session_id) as total_sessions,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(CASE WHEN event LIKE '%wizard_started%' THEN 1 END) as wizard_starts,
        COUNT(CASE WHEN event = 'wizard_completed' THEN 1 END) as wizard_completions,
        COUNT(CASE WHEN event LIKE '%download%' THEN 1 END) as downloads,
        COUNT(CASE WHEN event LIKE '%feedback%' AND event NOT LIKE '%comment%' THEN 1 END) as total_feedback,
        COUNT(CASE WHEN event LIKE '%feedback%' AND JSON_EXTRACT(properties, '$.answer') = 'yes' THEN 1 END) as positive_feedback,
        AVG(TIMESTAMPDIFF(SECOND, 
          (SELECT MIN(te2.created_at) FROM tracking_events te2 WHERE te2.session_id = tracking_events.session_id AND te2.source = 'preview'),
          (SELECT MAX(te2.created_at) FROM tracking_events te2 WHERE te2.session_id = tracking_events.session_id AND te2.source = 'preview')
        )) as avg_session_duration
      FROM tracking_events
      WHERE module = ?
        AND source = 'preview'
        ${dateFilter}
    `;

    const [[result]] = await sequelize.query(query, [moduleKey]);

    if (!result || result.total_sessions === 0) {
      return res.status(404).json({
        success: false,
        message: `No se encontraron datos para el MVP: ${moduleKey}`
      });
    }

    // Calcular rates
    const conversionRate = result.wizard_starts > 0
      ? Math.round((result.wizard_completions / result.wizard_starts) * 100)
      : 0;

    const downloadRate = result.wizard_completions > 0
      ? Math.round((result.downloads / result.wizard_completions) * 100)
      : 0;

    const positiveFeedbackRate = result.total_feedback > 0
      ? Math.round((result.positive_feedback / result.total_feedback) * 100)
      : 0;

    // Health Score
    const MIN_SESSIONS = 20;
    const insufficientData = result.total_sessions < MIN_SESSIONS;
    const healthScore = insufficientData ? 0 : Math.min(100, Math.round(
      (result.total_sessions / 100 * 30) +
      (conversionRate * 0.4) +
      (positiveFeedbackRate * 0.3)
    ));

    // Recomendación
    let recommendation = { action: 'wait', confidence: 0, reasoning: 'Datos insuficientes', icon: '⏳' };
    if (!insufficientData) {
      if (healthScore >= 70 && result.wizard_completions >= 10) {
        recommendation = { action: 'create_module', confidence: 85, reasoning: 'Listo para producción', icon: '🚀' };
      } else if (healthScore >= 50) {
        recommendation = { action: 'continue', confidence: 70, reasoning: 'Continuar validación', icon: '⏸️' };
      } else {
        recommendation = { action: 'archive', confidence: 60, reasoning: 'Considerar archivar', icon: '🗄️' };
      }
    }

    const moduleName = moduleKey.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

    res.json({
      success: true,
      analytics: {
        moduleName,
        moduleKey,
        health_score: healthScore,
        totalSessions: result.total_sessions,
        uniqueUsers: result.unique_users,
        wizard_starts: result.wizard_starts,
        wizard_completions: result.wizard_completions,
        conversion_rate: conversionRate,
        download_rate: downloadRate,
        positive_feedback_rate: positiveFeedbackRate,
        total_feedback: result.total_feedback,
        avg_session_duration: Math.round(result.avg_session_duration || 0),
        insufficient_data: insufficientData,
        recommendation,
        trends: {
          sessions: 0, // TODO: Comparar con período anterior
          starts: 0,
          completions: 0,
          feedback: 0
        }
      }
    });

  } catch (error) {
    console.error('❌ Error en getMvpDetail:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener analytics del MVP',
      error: error.message
    });
  }
};
