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
import { capitalize } from '../utils/string.utils.js';
import { TrackingEvent } from '../models/TrackingEvent.js';
import { Module } from '../domains/platform/models/Module.js';

import {
  getAllModuleAnalytics,
  getTrendingModuleAnalytics
} from '../domains/analytics/mvp/services/mvp-analytics-list.service.js';



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