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

    // Crear módulo
    const module = await Module.create({
      key,
      name,
      description: description || '',
      type,
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
      saas_config: saas_config || null
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
    if (status !== undefined) updates.status = status;
    if (validation_days !== undefined) updates.validation_days = validation_days;
    if (validation_target_sales !== undefined) updates.validation_target_sales = validation_target_sales;
    if (icon !== undefined) updates.icon = icon;
    if (color !== undefined) updates.color = color;
    if (base_price !== undefined) updates.base_price = base_price;
    if (config !== undefined) updates.config = { ...module.config, ...config };
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
    if (saas_config !== undefined) updates.saas_config = saas_config;

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

export default {
  listModules,
  getModuleByKey,
  toggleModule,
  getValidationStatus,
  archiveModule,
  markAsValidated,
  getModulesSummary,
  configurePreview,
  // Public endpoints
  listPublicModules,
  getPublicModuleByKey,
  getPublicModuleById // 🆕
};
