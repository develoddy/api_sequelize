import { Module } from '../models/Module.js';
import { Sale } from '../models/Sale.js';
import { Product } from '../models/Product.js';
import { SaleDetail } from '../models/SaleDetail.js';
import { Op } from 'sequelize';

/**
 * Controller: Modules
 * Gestión de módulos para sistema multi-producto (Levels-style)
 */

/**
 * Normalizar saas_config.dashboard_route
 * Asegura formato consistente: CON slash inicial, sin /dashboard duplicado
 * @param {Object} saasConfig - Configuración SaaS
 * @returns {Object} - Configuración normalizada
 */
function normalizeSaasConfig(saasConfig) {
  if (!saasConfig) return saasConfig;
  
  const config = typeof saasConfig === 'string' ? JSON.parse(saasConfig) : { ...saasConfig };
  
  if (config.dashboard_route !== undefined) {
    const original = config.dashboard_route;
    
    // Si está vacío o solo tiene espacios, convertir a null
    if (!original || original.trim() === '') {
      config.dashboard_route = null;
    } else {
      // Eliminar slashes finales
      let route = original.trim().replace(/\/+$/, '');
      
      // Normalizar múltiples slashes consecutivos a uno solo
      route = route.replace(/\/+/g, '/');
      
      // 🚨 FIX: Eliminar /dashboard al final si existe (ruta errónea común)
      route = route.replace(/\/dashboard$/, '');
      
      // Eliminar slashes finales otra vez después de eliminar /dashboard
      route = route.replace(/\/+$/, '');
      
      // 🔧 ASEGURAR que tenga slash inicial (es una ruta de frontend)
      if (route && !route.startsWith('/')) {
        route = '/' + route;
      }
      
      // Si quedó vacío, retornar null
      config.dashboard_route = route || null;
      
      if (original !== config.dashboard_route) {
        console.log(`📝 dashboard_route normalizado: "${original}" → "${config.dashboard_route}"`);
      }
    }
  }
  
  return config;
}

/**
 * GET /api/modules
 * Listar todos los módulos
 */
export const listModules = async (req, res) => {
  try {
    const modules = await Module.findAll({
      order: [
        ['is_active', 'DESC'],
        ['status', 'ASC'],
        ['created_at', 'DESC']
      ]
    });

    // Enriquecer con stats en tiempo real
    const modulesWithStats = await Promise.all(
      modules.map(async (module) => {
        const stats = await getModuleStats(module.id);
        const validationStatus = module.getValidationStatus();
        
        return {
          ...module.toJSON(),
          stats,
          validationStatus
        };
      })
    );

    res.json({
      success: true,
      modules: modulesWithStats,
      total: modules.length
    });
  } catch (error) {
    console.error('❌ Error listing modules:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * POST /api/modules
 * Crear un nuevo módulo
 */
export const createModule = async (req, res) => {
  try {
    const {
      key,
      name,
      description,
      type,
      validation_days,
      validation_target_sales,
      icon,
      color,
      base_price,
      config,
      // 🆕 Campos de marketing
      tagline,
      screenshots,
      download_url,
      post_purchase_email,
      detailed_description,
      features,
      tech_stack,
      requirements,
      // 🚀 SaaS fields
      saas_config
    } = req.body;

    // Validar campos requeridos
    if (!key || !name || !type) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: key, name, type'
      });
    }

    // Verificar que el key no exista
    const existing = await Module.findOne({ where: { key } });
    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'A module with this key already exists'
      });
    }

    // 🎯 Auto-generar concept_name (base concept sin sufijos de fase)
    // Si key termina en '-landing' o '-wizard', remover el sufijo
    // Esto asegura que todas las fases del mismo MVP compartan el mismo concept_name
    let conceptName = key;
    if (key.endsWith('-landing')) {
      conceptName = key.replace('-landing', '');
    } else if (key.endsWith('-wizard')) {
      conceptName = key.replace('-wizard', '');
    }
    // Si no tiene sufijo, usar el key completo como concept_name

    // 🎯 Auto-detectar module_type basándose en el sufijo del key
    // Lógica:
    // - Si key termina en '-landing' → module_type = 'landing' (fase 0)
    // - Si key termina en '-wizard' → module_type = 'wizard' (fase 1)
    // - Si no tiene sufijo → module_type = 'live' (fase 2)
    let moduleType = 'live'; // Default para keys sin sufijo
    let phaseOrder = 2; // Default para live
    
    if (key.endsWith('-landing')) {
      moduleType = 'landing';
      phaseOrder = 0;
    } else if (key.endsWith('-wizard')) {
      moduleType = 'wizard';
      phaseOrder = 1;
    }

    // 🎯 Auto-generar preview_config básico
    const defaultPreviewConfig = {
      enabled: true,
      status: 'draft', // Sincronizado con module.status
      dashboard_route: `/${key}`,
      api_endpoint: '',
      trial_days: 14,
      route: `/preview/${key}`,
      show_in_store: false, // Solo cuando status='live'
      demo_button_text: 'Try Demo - No signup required',
      rate_limiting: {
        max_requests: 10,
        window_minutes: 15
      }
    };

    // 📊 Log de valores auto-detectados
    console.log('🎯 Auto-detection results:');
    console.log(`   key: ${key}`);
    console.log(`   concept_name: ${conceptName} (base without suffix)`);
    console.log(`   module_type: ${moduleType} (detected from key suffix)`);
    console.log(`   phase_order: ${phaseOrder} (0=landing, 1=wizard, 2=live)`);

    // Crear módulo
    const module = await Module.create({
      key,
      name,
      description: description || '',
      type,
      module_type: moduleType, // 🆕 Auto-detectado basándose en key
      concept_name: conceptName, // 🆕 Auto-asignado basándose en key
      phase_order: phaseOrder, // 🆕 Auto-asignado basándose en module_type
      is_active: false,
      status: 'draft',
      validation_days: validation_days || 14,
      validation_target_sales: validation_target_sales || 1,
      icon: icon || 'fa-cube',
      color: color || 'primary',
      base_price: base_price || null,
      currency: 'EUR',
      config: config || {},
      total_sales: 0,
      total_revenue: 0,
      total_orders: 0,
      // 🆕 Campos de marketing
      tagline: tagline || null,
      screenshots: screenshots || [],
      download_url: download_url || null,
      post_purchase_email: post_purchase_email || null,
      detailed_description: detailed_description || null,
      features: features || [],
      tech_stack: tech_stack || [],
      requirements: requirements || {},
      // 🚀 SaaS config
      saas_config: saas_config ? normalizeSaasConfig(saas_config) : null,
      // 🎯 Preview config auto-generado
      preview_config: defaultPreviewConfig
    });

    console.log(`✅ Module created: ${module.name} (${module.key})`);

    res.status(201).json({
      success: true,
      module: module.toJSON(),
      message: 'Module created successfully'
    });
  } catch (error) {
    console.error('❌ Error creating module:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * PUT /api/modules/:key
 * Actualizar un módulo existente
 */
export const updateModule = async (req, res) => {
  try {
    const { key } = req.params;
    const {
      name,
      description,
      type,
      status,
      validation_days,
      validation_target_sales,
      icon,
      color,
      base_price,
      config,
      // 🆕 Campos de marketing
      tagline,
      screenshots,
      download_url,
      post_purchase_email,
      detailed_description,
      features,
      tech_stack,
      requirements,
      // 🚀 SaaS fields
      saas_config
    } = req.body;

    const module = await Module.findOne({ where: { key } });
    
    if (!module) {
      return res.status(404).json({
        success: false,
        error: 'Module not found'
      });
    }

    // Actualizar solo campos proporcionados
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (type !== undefined) updates.type = type;
    if (status !== undefined) {
      updates.status = status;
      
      // 🎯 Auto-sincronizar status en preview_config
      if (module.preview_config) {
        // 🛡️ Asegurar que preview_config es un objeto (no string)
        // Previene corrupción cuando Sequelize devuelve string en lugar de objeto
        const currentConfig = typeof module.preview_config === 'string'
          ? JSON.parse(module.preview_config)
          : module.preview_config;

        updates.preview_config = {
          ...currentConfig,
          status: status,
          show_in_store: status === 'live' // Mostrar solo si está live
        };
      } else {
        // Si no existe preview_config, crearlo automáticamente
        updates.preview_config = {
          enabled: true,
          status: status,
          dashboard_route: `/${key}`,
          api_endpoint: '',
          trial_days: 14,
          route: `/preview/${key}`,
          show_in_store: status === 'live',
          demo_button_text: 'Try Demo - No signup required',
          rate_limiting: {
            max_requests: 10,
            window_minutes: 15
          }
        };
      }
    }
    if (validation_days !== undefined) updates.validation_days = validation_days;
    if (validation_target_sales !== undefined) updates.validation_target_sales = validation_target_sales;
    if (icon !== undefined) updates.icon = icon;
    if (color !== undefined) updates.color = color;
    if (base_price !== undefined) updates.base_price = base_price;
    if (config !== undefined) {
      // 🛡️ Asegurar que config es un objeto (prevenir corrupción)
      const currentConfig = typeof module.config === 'string'
        ? JSON.parse(module.config)
        : (module.config || {});
      updates.config = { ...currentConfig, ...config };
    }
    // 🆕 Campos de marketing
    if (tagline !== undefined) updates.tagline = tagline;
    if (screenshots !== undefined) updates.screenshots = screenshots;
    if (download_url !== undefined) updates.download_url = download_url;
    if (post_purchase_email !== undefined) updates.post_purchase_email = post_purchase_email;
    if (detailed_description !== undefined) updates.detailed_description = detailed_description;
    if (features !== undefined) updates.features = features;
    if (tech_stack !== undefined) updates.tech_stack = tech_stack;
    if (requirements !== undefined) updates.requirements = requirements;
    // 🚀 SaaS config
    if (saas_config !== undefined) updates.saas_config = normalizeSaasConfig(saas_config);

    await module.update(updates);

    console.log(`✅ Module updated: ${module.name} (${module.key})`);

    res.json({
      success: true,
      module: module.toJSON(),
      message: 'Module updated successfully'
    });
  } catch (error) {
    console.error('❌ Error updating module:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * GET /api/modules/:key
 * Obtener detalles de un módulo específico
 */
export const getModuleByKey = async (req, res) => {
  try {
    const { key } = req.params;

    const module = await Module.findOne({ where: { key } });
    
    if (!module) {
      return res.status(404).json({
        success: false,
        error: 'Module not found'
      });
    }

    // Stats detalladas
    const stats = await getModuleStats(module.id);
    const validationStatus = module.getValidationStatus();
    
    // Últimas ventas
    const recentSales = await Sale.findAll({
      where: { module_id: module.id },
      order: [['createdAt', 'DESC']],
      limit: 10,
      attributes: ['id', 'n_transaction', 'total', 'syncStatus', 'printfulStatus', 'createdAt']
    });

    res.json({
      success: true,
      module: module.toJSON(),
      stats,
      validationStatus,
      recentSales
    });
  } catch (error) {
    console.error('❌ Error getting module:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * PATCH /api/modules/:key/toggle
 * Activar/Desactivar un módulo
 */
export const toggleModule = async (req, res) => {
  try {
    const { key } = req.params;

    const module = await Module.findOne({ where: { key } });
    
    if (!module) {
      return res.status(404).json({
        success: false,
        error: 'Module not found'
      });
    }

    const newActiveState = !module.is_active;
    
    // ⚠️ IMPORTANTE: Toggle solo cambia is_active, NO cambia status
    // El status (draft/testing/live/archived) se gestiona manualmente en la edición del módulo
    // La validación automática (testing → live) se hace cuando se alcanza el target de ventas
    
    // Actualizar solo is_active (sin tocar status ni launched_at)
    await module.update({
      is_active: newActiveState
    });

    console.log(`${newActiveState ? '✅' : '⏸️'} Module ${module.name} ${newActiveState ? 'activated' : 'deactivated'}`);

    res.json({
      success: true,
      module: module.toJSON(),
      message: `Module ${newActiveState ? 'activated' : 'deactivated'} successfully`
    });
  } catch (error) {
    console.error('❌ Error toggling module:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * GET /api/modules/:key/validation-status
 * Obtener estado de validación detallado
 */
export const getValidationStatus = async (req, res) => {
  try {
    const { key } = req.params;

    const module = await Module.findOne({ where: { key } });
    
    if (!module) {
      return res.status(404).json({
        success: false,
        error: 'Module not found'
      });
    }

    const validationStatus = module.getValidationStatus();

    res.json({
      success: true,
      validationStatus
    });
  } catch (error) {
    console.error('❌ Error getting validation status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * POST /api/modules/:key/archive
 * Archivar un módulo que no validó
 */
export const archiveModule = async (req, res) => {
  try {
    const { key } = req.params;
    const { reason } = req.body;

    const module = await Module.findOne({ where: { key } });
    
    if (!module) {
      return res.status(404).json({
        success: false,
        error: 'Module not found'
      });
    }

    await module.update({
      is_active: false,
      status: 'archived',
      archived_at: new Date(),
      config: {
        ...module.config,
        archive_reason: reason || 'Did not validate',
        archived_by: 'admin'
      }
    });

    console.log(`📦 Module ${module.name} archived`);

    res.json({
      success: true,
      module: module.toJSON(),
      message: 'Module archived successfully'
    });
  } catch (error) {
    console.error('❌ Error archiving module:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * PATCH /api/modules/:key/validate
 * Marcar un módulo como validado manualmente
 */
export const markAsValidated = async (req, res) => {
  try {
    const { key } = req.params;

    const module = await Module.findOne({ where: { key } });
    
    if (!module) {
      return res.status(404).json({
        success: false,
        error: 'Module not found'
      });
    }

    if (module.validated_at) {
      return res.status(400).json({
        success: false,
        error: 'Module already validated'
      });
    }
    
    // 🎯 Verificar si cumple con el criterio de validación
    if (module.status === 'testing' && module.total_sales >= module.validation_target_sales) {
      await module.update({
        status: 'live',
        validated_at: new Date()
      });
      
      console.log(`✅ Module ${module.name} marked as validated (manual trigger)`);

      return res.json({
        success: true,
        module: module.toJSON(),
        message: 'Module validated successfully'
      });
    }

    // Si no cumple criterio, validar manualmente de todos modos
    await module.update({
      status: 'live',
      validated_at: new Date()
    });

    console.log(`✅ Module ${module.name} marked as validated`);

    res.json({
      success: true,
      module: module.toJSON(),
      message: 'Module validated successfully'
    });
  } catch (error) {
    console.error('❌ Error validating module:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * GET /api/modules/stats/summary
 * Resumen general de todos los módulos
 */
export const getModulesSummary = async (req, res) => {
  try {
    const totalModules = await Module.count();
    const activeModules = await Module.count({ where: { is_active: true } });
    const validatedModules = await Module.count({ 
      where: { 
        validated_at: { [Op.not]: null } 
      } 
    });
    const testingModules = await Module.count({ where: { status: 'testing' } });
    const archivedModules = await Module.count({ where: { status: 'archived' } });

    // Revenue total
    const modules = await Module.findAll();
    const totalRevenue = modules.reduce((sum, m) => sum + parseFloat(m.total_revenue), 0);

    res.json({
      success: true,
      summary: {
        total: totalModules,
        active: activeModules,
        validated: validatedModules,
        testing: testingModules,
        archived: archivedModules,
        totalRevenue: totalRevenue.toFixed(2)
      }
    });
  } catch (error) {
    console.error('❌ Error getting modules summary:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Helper: Obtener estadísticas de un módulo
 */
async function getModuleStats(moduleId) {
  try {
    const totalProducts = await Product.count({ 
      where: { module_id: moduleId } 
    });
    
    const totalOrders = await Sale.count({ 
      where: { module_id: moduleId } 
    });
    
    // Usar syncStatus en lugar de status
    const pendingOrders = await Sale.count({ 
      where: { 
        module_id: moduleId,
        syncStatus: { [Op.in]: ['pending', 'failed'] }
      } 
    });

    // Revenue puede estar en Sale o calcularse
    const sales = await Sale.findAll({
      where: { module_id: moduleId },
      attributes: ['total']
    });
    
    const totalRevenue = sales.reduce((sum, sale) => {
      return sum + parseFloat(sale.total || 0);
    }, 0);

    return {
      totalProducts,
      totalOrders,
      pendingOrders,
      totalRevenue: totalRevenue.toFixed(2)
    };
  } catch (error) {
    console.error('Error getting module stats:', error);
    return {
      totalProducts: 0,
      totalOrders: 0,
      pendingOrders: 0,
      totalRevenue: '0.00'
    };
  }
}

/**
 * 🌐 PUBLIC ENDPOINTS (para frontend ecommerce)
 */

/**
 * GET /api/modules/public
 * Listar módulos activos (solo is_active=true y status=live)
 */
export const listPublicModules = async (req, res) => {
  try {
    // 🔓 Mostrar módulos activos en 'testing' o 'live' (Build in Public: validar públicamente)
    const modules = await Module.findAll({
      where: {
        is_active: true,
        status: ['testing', 'live'] // 🆕 Incluir testing para validación pública
      },
      order: [['created_at', 'DESC']]
    });

    // Agregar stats básicas (sin información administrativa)
    const modulesWithStats = await Promise.all(
      modules.map(async (module) => {
        const stats = await getModuleStats(module.id);
        
        return {
          id: module.id,
          key: module.key,
          name: module.name,
          description: module.description,
          type: module.type,
          icon: module.icon,
          color: module.color,
          price_base: module.base_price,
          is_active: module.is_active,
          status: module.status,
          createdAt: module.created_at,
          // Stats públicas (sin info sensible)
          totalSales: parseInt(stats.totalOrders) || 0,
          totalRevenue: parseFloat(stats.totalRevenue) || 0
        };
      })
    );

    res.json(modulesWithStats);
  } catch (error) {
    console.error('❌ Error listing public modules:', error);
    res.status(500).json({
      success: false,
      error: 'Error loading modules'
    });
  }
};

/**
 * GET /api/modules/public/:key
 * Obtener módulo público por key (activo y en testing/live)
 */
export const getPublicModuleByKey = async (req, res) => {
  try {
    const { key } = req.params;

    const module = await Module.findOne({ 
      where: { 
        key,
        is_active: true,
        status: ['testing', 'live'] // 🆕 Incluir testing para Build in Public
      } 
    });
    
    if (!module) {
      return res.status(404).json({
        success: false,
        error: 'Module not found or not available'
      });
    }

    // Stats del módulo
    const stats = await getModuleStats(module.id);
    
    // Validación status (si está en testing)
    let validationStatus = null;
    if (module.status === 'testing' && module.launched_at) {
      validationStatus = module.getValidationStatus();
    }

    // Ventas recientes (últimas 10, sin información sensible)
    const recentSales = await Sale.findAll({
      where: { module_id: module.id },
      attributes: ['id', 'n_transaction', 'total', 'syncStatus', 'createdAt'],
      order: [['createdAt', 'DESC']],
      limit: 10
    });

    // 🔧 Helper para parsear JSON si viene como string
    const parseJsonField = (field) => {
      if (!field) return null;
      if (typeof field === 'string') {
        try {
          return JSON.parse(field);
        } catch {
          return field;
        }
      }
      return field;
    };

    res.json({
      module: {
        id: module.id,
        key: module.key,
        name: module.name,
        description: module.description,
        type: module.type,
        icon: module.icon,
        color: module.color,
        base_price: module.base_price, // ✅ Cambiado a base_price para consistencia con frontend
        is_active: module.is_active,
        status: module.status,
        createdAt: module.created_at,
        // 🆕 Campos de marketing para landing dinámica
        tagline: module.tagline,
        screenshots: parseJsonField(module.screenshots) || [],
        download_url: module.download_url,
        post_purchase_email: module.post_purchase_email,
        detailed_description: module.detailed_description,
        features: parseJsonField(module.features) || [],
        tech_stack: parseJsonField(module.tech_stack) || [],
        requirements: parseJsonField(module.requirements) || {},
        // 🚀 SaaS config
        saas_config: parseJsonField(module.saas_config) || null
      },
      stats: {
        totalSales: parseInt(stats.totalOrders) || 0,
        totalRevenue: parseFloat(stats.totalRevenue) || 0,
        progress: validationStatus?.progress || 0
      },
      validationStatus,
      recentSales
    });
  } catch (error) {
    console.error('❌ Error getting public module:', error);
    res.status(500).json({
      success: false,
      error: 'Error loading module'
    });
  }
};

/**
 * 🆕 GET /api/modules/:id
 * Obtener módulo público por ID (para checkout)
 */
export const getPublicModuleById = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('🔍 [ModulesController] getPublicModuleById - ID:', id);

    const module = await Module.findByPk(id);
    
    if (!module) {
      console.log('❌ [ModulesController] Module not found with ID:', id);
      return res.status(404).json({
        success: false,
        error: 'Module not found'
      });
    }
    
    console.log('✅ [ModulesController] Module found:', {
      id: module.id,
      name: module.name,
      type: module.type,
      base_price: module.base_price
    });

    // Respuesta simplificada para checkout
    res.json({
      module: {
        id: module.id,
        key: module.key,
        name: module.name,
        title: module.name, // Alias para compatibilidad
        description: module.description,
        type: module.type,
        base_price: module.base_price,
        price: module.base_price, // Alias para compatibilidad
        is_active: module.is_active
      }
    });
  } catch (error) {
    console.error('❌ [ModulesController] Error getting module by ID:', error);
    res.status(500).json({
      success: false,
      error: 'Error loading module'
    });
  }
};

/**
 * POST /api/modules/:key/configure-preview
 * Configurar preview mode para un módulo
 */
export const configurePreview = async (req, res) => {
  try {
    const { key } = req.params;
    
    // Buscar módulo
    const module = await Module.findOne({
      where: { key }
    });
    
    if (!module) {
      return res.status(404).json({
        success: false,
        error: 'Module not found'
      });
    }
    
    // Configuración predeterminada según el tipo de módulo
    const defaultPreviewConfig = {
      enabled: true,
      route: `/preview/${key}`,
      public_endpoint: `/api/modules/${key}/preview/generate`,
      show_in_store: true,
      demo_button_text: 'Try Demo - No signup required',
      generator_function: `generate${key.charAt(0).toUpperCase() + key.slice(1)}Preview`,
      conversion_config: {
        recovery_key: `${key}_preview`,
        redirect_route: `/${key}/onboarding`,
        auto_activate: true
      },
      rate_limiting: {
        max_requests: 10,
        window_minutes: 15
      }
    };
    
    // Actualizar módulo
    await module.update({
      preview_config: defaultPreviewConfig
    });
    
    res.json({
      success: true,
      message: `Preview mode configured for module '${module.name}'`,
      config: defaultPreviewConfig
    });
    
  } catch (error) {
    console.error('❌ Error configuring preview:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * 🆕 Create Next Phase Module
 * Creates the next phase in MVP validation progression (landing → wizard → live)
 * POST /api/admin/modules/create-next-phase
 */
export const createNextPhase = async (req, res) => {
  try {
    const { parent_module_id, reason, name_override, description_override } = req.body;

    // 🔍 DEBUG: Log received data
    console.log('🔍 [createNextPhase] Received request:');
    console.log('   parent_module_id:', parent_module_id, '(type:', typeof parent_module_id, ')');
    console.log('   reason:', reason);
    console.log('   name_override:', name_override);

    // 1. Validate parent module exists
    const parentModule = await Module.findByPk(parent_module_id);
    
    console.log('🔍 [createNextPhase] Query result:');
    console.log('   parentModule found:', !!parentModule);
    if (parentModule) {
      console.log('   parentModule.id:', parentModule.id);
      console.log('   parentModule.key:', parentModule.key);
      console.log('   parentModule.module_type:', parentModule.module_type);
    }
    
    if (!parentModule) {
      console.log('❌ [createNextPhase] Parent module NOT found with ID:', parent_module_id);
      return res.status(404).json({
        success: false,
        error: 'Parent module not found'
      });
    }

    // 2. Check if next phase already exists
    const existingNextPhase = await parentModule.getNextPhase();
    if (existingNextPhase) {
      return res.status(400).json({
        success: false,
        error: `Next phase already exists: ${existingNextPhase.key}`,
        existing_module: existingNextPhase
      });
    }

    // 3. Get parent module analytics (we'll do a simplified validation)
    // For now, we'll use soft validation (show warning but allow creation)
    const phaseTypeMap = {
      landing: 'wizard',
      wizard: 'live',
      live: null
    };

    console.log('🔍 [createNextPhase] Phase progression:');
    console.log('   parentModule.module_type:', parentModule.module_type, '(type:', typeof parentModule.module_type, ')');
    console.log('   parentModule.module_type length:', parentModule.module_type?.length);
    console.log('   parentModule.module_type bytes:', Buffer.from(parentModule.module_type || '').toString('hex'));
    
    // 🔧 Limpiar el module_type de espacios en blanco y caracteres invisibles
    const cleanModuleType = (parentModule.module_type || '').toString().trim();
    console.log('   cleanModuleType:', cleanModuleType, '(trimmed)');
    
    const nextPhaseType = phaseTypeMap[cleanModuleType];
    console.log('   nextPhaseType:', nextPhaseType, '(type:', typeof nextPhaseType, ')');
    console.log('   nextPhaseType length:', nextPhaseType?.length);
    
    if (!nextPhaseType) {
      return res.status(400).json({
        success: false,
        error: 'Parent module is already at final phase (live)'
      });
    }

    // 4. Generate next phase key
    // Extract base concept name (remove phase suffixes if present)
    let baseConcept = parentModule.concept_name || parentModule.key;
    
    // Remove any phase suffixes from concept_name to get clean base
    baseConcept = baseConcept.replace(/-landing$/, '').replace(/-wizard$/, '');
    
    let nextPhaseKey;
    if (cleanModuleType === 'landing') {
      // inbox-zero-prevention-landing → inbox-zero-prevention-wizard
      nextPhaseKey = `${baseConcept}-wizard`;
    } else if (cleanModuleType === 'wizard') {
      // inbox-zero-prevention-wizard → inbox-zero-prevention (live doesn't have suffix)
      nextPhaseKey = baseConcept;
    }

    // Check if key already exists
    const existingModule = await Module.findOne({ where: { key: nextPhaseKey } });
    if (existingModule) {
      return res.status(400).json({
        success: false,
        error: `Module with key '${nextPhaseKey}' already exists`,
        existing_module: existingModule
      });
    }

    // 5. Create next phase module with inherited data
    const nextPhaseName = name_override || `${parentModule.name} - ${nextPhaseType.charAt(0).toUpperCase() + nextPhaseType.slice(1)}`;
    const nextPhaseDescription = description_override || parentModule.description;

    console.log('🔍 [createNextPhase] About to create module with data:');
    
    // 🔧 Asegurar que module_type sea un string limpio
    const cleanNextPhaseType = nextPhaseType.toString().trim();
    
    // 🔧 Asegurar que config sea un objeto válido
    let parentConfig = {};
    if (parentModule.config) {
      if (typeof parentModule.config === 'string') {
        try {
          parentConfig = JSON.parse(parentModule.config);
        } catch (e) {
          console.warn('⚠️ Parent config is string but not valid JSON, using empty object');
          parentConfig = {};
        }
      } else if (typeof parentModule.config === 'object') {
        parentConfig = parentModule.config;
      }
    }
    
    const moduleData = {
      key: nextPhaseKey,
      name: nextPhaseName,
      description: nextPhaseDescription,
      tagline: parentModule.tagline,
      detailed_description: parentModule.detailed_description,
      type: parentModule.type,
      module_type: cleanNextPhaseType, // 🔧 Usar valor limpio
      status: 'draft',
      is_active: false,
      show_in_store: false,
      parent_module_id: parent_module_id,
      concept_name: baseConcept,
      phase_order: parentModule.phase_order + 1,
      icon: parentModule.icon,
      color: parentModule.color,
      validation_days: parentModule.validation_days,
      validation_target_sales: parentModule.validation_target_sales,
      config: {
        ...parentConfig, // 🔧 Usar objeto parseado correctamente
        created_from_parent: true,
        progression_reason: reason || 'Created from parent module'
      }
    };
    
    console.log('   module_type value:', JSON.stringify(moduleData.module_type));
    console.log('   module_type is string:', typeof moduleData.module_type === 'string');
    console.log('   module_type length:', moduleData.module_type.length);
    console.log('   module_type bytes:', Buffer.from(moduleData.module_type).toString('hex'));
    console.log('   Full data:', JSON.stringify(moduleData, null, 2));

    // 🔍 Validar que module_type sea uno de los valores permitidos
    const validModuleTypes = ['landing', 'wizard', 'live'];
    if (!validModuleTypes.includes(moduleData.module_type)) {
      console.error('❌ INVALID module_type:', moduleData.module_type);
      console.error('   Expected one of:', validModuleTypes);
      console.error('   Received type:', typeof moduleData.module_type);
      console.error('   Received bytes:', Buffer.from(moduleData.module_type).toString('hex'));
      
      return res.status(400).json({
        success: false,
        error: `Invalid module_type: "${moduleData.module_type}". Must be one of: ${validModuleTypes.join(', ')}`,
        debug: {
          received: moduleData.module_type,
          valid_values: validModuleTypes,
          parent_module_type: parentModule.module_type
        }
      });
    }

    console.log('✅ module_type is valid:', moduleData.module_type);

    const newModule = await Module.create(moduleData);

    // 6. Return success with parent and child data
    res.status(201).json({
      success: true,
      message: `Successfully created ${cleanNextPhaseType} phase for concept '${parentModule.concept_name}'`,
      module: newModule,
      parent: {
        id: parentModule.id,
        key: parentModule.key,
        name: parentModule.name,
        module_type: parentModule.module_type,
        phase_order: parentModule.phase_order
      },
      next_steps: cleanNextPhaseType === 'wizard' 
        ? [
          'Configure wizard flow in module settings',
          'Set up tracking events for wizard_started and wizard_completed',
          'Test wizard flow before moving to testing status',
          'Validate with 50+ completions before creating live product'
        ]
        : [
          'Configure full product features',
          'Set up pricing and monetization',
          'Prepare for production deployment',
          'Launch to live when ready'
        ]
    });

  } catch (error) {
    console.error('[createNextPhase] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * 🆕 Get Concept Phases
 * Returns all modules for a given concept (landing, wizard, live)
 * GET /api/admin/modules/concepts/:conceptName/phases
 */
export const getConceptPhases = async (req, res) => {
  try {
    const { conceptName } = req.params;

    const phases = await Module.findAll({
      where: { concept_name: conceptName },
      order: [['phase_order', 'ASC']],
      include: [
        {
          model: Module,
          as: 'parent',
          attributes: ['id', 'key', 'name', 'module_type', 'phase_order']
        },
        {
          model: Module,
          as: 'children',
          attributes: ['id', 'key', 'name', 'module_type', 'phase_order', 'status']
        }
      ]
    });

    if (phases.length === 0) {
      return res.status(404).json({
        success: false,
        error: `No modules found for concept '${conceptName}'`
      });
    }

    res.json({
      success: true,
      concept_name: conceptName,
      total_phases: phases.length,
      current_phase: phases.find(p => p.status === 'live' || p.status === 'testing')?.module_type || phases[phases.length - 1].module_type,
      phases: phases
    });

  } catch (error) {
    console.error('[getConceptPhases] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

export default {
  listModules,
  getModuleByKey,
  toggleModule,
  getValidationStatus,
  archiveModule,
  markAsValidated,
  getModulesSummary,
  configurePreview,
  createNextPhase, // 🆕
  getConceptPhases, // 🆕
  // Public endpoints
  listPublicModules,
  getPublicModuleByKey,
  getPublicModuleById // 🆕
};
