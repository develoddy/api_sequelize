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

import { calculateModuleAnalytics } from '../domains/analytics/mvp/mvp-analytics.service.js';

import {
  getAllModuleAnalytics,
  getTrendingModuleAnalytics
} from '../domains/analytics/mvp/services/mvp-analytics-list.service.js';

import {
  isValidMVPDecisionAction,
  executeMVPDecisionAction
} from '../domains/analytics/mvp/services/mvp-decision.service.js';

import {
  createModuleFromValidatedMVP,
  MVPModuleAlreadyExistsError,
  MVPAnalyticsNotFoundError
} from '../domains/analytics/mvp/services/mvp-module-creation.service.js';


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

    console.log(
      `📊 Obteniendo analytics de módulos activos (período: ${period})...`
    );

    const result = await getAllModuleAnalytics(period);

    return res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error(
      '❌ Error getting all analytics:',
      error
    );

    return res.status(500).json({
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

    const result = await createModuleFromValidatedMVP({
      moduleKey,
      autoActivate: auto_activate,
      copyPreviewConfig: copy_preview_config,
      initialStatus: initial_status
    });

    console.log(
      `✅ Module created from MVP: ${moduleKey} (ID: ${result.module.id})`
    );

    return res.json({
      success: true,
      module: result.module.toJSON(),
      analytics: result.analytics,
      message: result.message,
      next_steps: result.next_steps
    });
  } catch (error) {
    if (error instanceof MVPModuleAlreadyExistsError) {
      return res.status(409).json({
        success: false,
        error: error.message,
        module: error.module
      });
    }

    if (error instanceof MVPAnalyticsNotFoundError) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    console.error(
      `❌ Error creating module from MVP ${req.params.moduleKey}:`,
      error
    );

    return res.status(500).json({
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
    
    if (!isValidMVPDecisionAction(action)) {
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
    
    const result = await executeMVPDecisionAction({
      moduleKey,
      action,
      reason
    });
    
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
    const trending = await getTrendingModuleAnalytics({
      period: '7d',
      minimumHealthScore: 60,
      limit: 5
    });

    return res.json({
      success: true,
      trending,
      period: '7d'
    });
  } catch (error) {
    console.error(
      '❌ Error getting trending MVPs:',
      error
    );

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};