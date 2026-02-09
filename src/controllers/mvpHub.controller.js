/**
 * Controller: MVP Hub
 * 
 * Endpoints para el MVP Hub Landing.
 * 
 * PRINCIPIO CLAVE:
 * - NO lista módulos técnicos de la DB
 * - Lista SOLO MVPs con señales reales de tracción
 * - Excluye demos, placeholders y módulos internos
 * - La raíz / funciona como radar de tracción, no como catálogo técnico
 * 
 * Este controlador es HONESTO: solo muestra lo que realmente funciona.
 */

import { getActiveMvps, getMvpDetailedMetrics, checkPromotionCriteria } from '../services/mvpMetrics.service.js';
import { Module } from '../models/Module.js';

/**
 * GET /api/mvp-hub/modules
 * 
 * Obtener MVPs activos con señales reales de tracción.
 * Solo MVPs que tienen pulso y merecen aparecer en /.
 * 
 * Este endpoint NO depende de show_in_store ni flags técnicos.
 * Depende de métricas reales: sesiones, conversiones, feedback, uso.
 * 
 * CRITERIOS DE APARICIÓN:
 * - Health score > 0 (calculado con señales reales)
 * - NO es demo/template/internal-tool
 * - NO es key-module (excluido explícitamente)
 * - Tiene actividad en últimos 30 días
 * 
 * @returns {Array} MVPs ordenados por health score (más tracción primero)
 */
export async function getMvpHubModules(req, res) {
  try {
    console.log('🔍 Buscando MVPs con señales reales de tracción...');

    // Obtener MVPs activos (ya filtrados por métricas reales)
    const activeMvps = await getActiveMvps();

    if (activeMvps.length === 0) {
      console.log('⚠️  No hay MVPs con señales reales de tracción');
      return res.json({
        success: true,
        mvps: [],
        count: 0,
        message: 'No hay experimentos activos con tracción demostrable'
      });
    }

    // Formatear para el Hub
    const formattedMvps = activeMvps.map(mvp => {
      // Parse configs
      let saasConfig = mvp.saas_config;
      let previewConfig = mvp.preview_config;
      
      if (typeof saasConfig === 'string') {
        try {
          saasConfig = JSON.parse(saasConfig);
        } catch (e) {
          saasConfig = {};
        }
      }
      
      if (typeof previewConfig === 'string') {
        try {
          previewConfig = JSON.parse(previewConfig);
        } catch (e) {
          previewConfig = {};
        }
      }

      // Construir respuesta
      return {
        key: mvp.key,
        name: mvp.name,
        tagline: mvp.tagline || `Herramienta para ${mvp.name}`,
        description: mvp.description || '',
        icon: mvp.icon || 'bi-box',
        color: mvp.color || '#6366f1',
        status: mvp.status,
        type: mvp.type,
        
        // Features del MVP
        features: saasConfig?.features || [
          'Fácil de usar',
          'Sin configuración técnica',
          'Resultados inmediatos'
        ],
        
        // Ruta de preview
        previewRoute: previewConfig?.enabled 
          ? `/preview/${mvp.key}`
          : null,
        
        // Stats reales (no inventadas)
        stats: {
          activeUsers: mvp.metrics.activeTenants || 0,
          recentSessions: mvp.metrics.recentSessions || 0,
          healthScore: mvp.healthScore,
          trialDays: saasConfig?.trial_days || 14
        },
        
        // Metadata
        createdAt: mvp.created_at
      };
    });

    console.log(`✅ Mostrando ${formattedMvps.length} MVPs con tracción real`);

    res.json({
      success: true,
      count: formattedMvps.length,
      mvps: formattedMvps
    });

  } catch (error) {
    console.error('❌ Error fetching active MVPs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load active experiments'
    });
  }
}

/**
 * GET /api/mvp-hub/modules/:key
 * 
 * Obtener detalles completos de un MVP específico.
 * Incluye métricas detalladas y criterios de promoción.
 */
export async function getMvpHubModuleDetails(req, res) {
  try {
    const { key } = req.params;

    // Obtener módulo base
    const module = await Module.findOne({
      where: { key, is_active: true }
    });

    if (!module) {
      return res.status(404).json({
        success: false,
        error: 'MVP not found'
      });
    }

    // Obtener métricas detalladas
    const metrics = await getMvpDetailedMetrics(key);
    
    // Verificar criterios de promoción
    const promotionCheck = await checkPromotionCriteria(key);

    // Parse configs
    let saasConfig = module.saas_config;
    let previewConfig = module.preview_config;
    
    if (typeof saasConfig === 'string') {
      saasConfig = JSON.parse(saasConfig);
    }
    if (typeof previewConfig === 'string') {
      previewConfig = JSON.parse(previewConfig);
    }

    res.json({
      success: true,
      mvp: {
        ...module.toJSON(),
        metrics: metrics.metrics,
        healthScore: metrics.healthScore,
        isAlive: metrics.isAlive,
        promotion: promotionCheck,
        saas_config: saasConfig,
        preview_config: previewConfig
      }
    });

  } catch (error) {
    console.error(`❌ Error fetching MVP details for ${req.params.key}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to load MVP details'
    });
  }
}

/**
 * GET /api/mvp-hub/promotion-candidates
 * 
 * Listar MVPs candidatos a convertirse en módulos estables.
 * Solo para uso interno/admin.
 */
export async function getPromotionCandidates(req, res) {
  try {
    const activeMvps = await getActiveMvps();
    
    const candidates = await Promise.all(
      activeMvps.map(async mvp => {
        const promotionCheck = await checkPromotionCriteria(mvp.key);
        return {
          key: mvp.key,
          name: mvp.name,
          healthScore: mvp.healthScore,
          ...promotionCheck
        };
      })
    );

    // Filtrar solo los que están listos
    const readyCandidates = candidates.filter(c => c.readyForPromotion);

    res.json({
      success: true,
      count: readyCandidates.length,
      candidates: readyCandidates,
      all: candidates // incluir todos para transparencia
    });

  } catch (error) {
    console.error('❌ Error checking promotion candidates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check promotion candidates'
    });
  }
}
