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
      config
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
      total_orders: 0
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
      validation_days,
      validation_target_sales,
      icon,
      color,
      base_price,
      config
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
    if (validation_days !== undefined) updates.validation_days = validation_days;
    if (validation_target_sales !== undefined) updates.validation_target_sales = validation_target_sales;
    if (icon !== undefined) updates.icon = icon;
    if (color !== undefined) updates.color = color;
    if (base_price !== undefined) updates.base_price = base_price;
    if (config !== undefined) updates.config = { ...module.config, ...config };

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
    
    // Determinar nuevo status
    let newStatus = module.status;
    if (newActiveState) {
      // Activando
      newStatus = 'testing';
    } else {
      // Desactivando
      newStatus = module.isValidated() ? 'live' : 'draft';
    }

    // Actualizar
    await module.update({
      is_active: newActiveState,
      status: newStatus,
      launched_at: newActiveState && !module.launched_at ? new Date() : module.launched_at
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

export default {
  listModules,
  getModuleByKey,
  toggleModule,
  getValidationStatus,
  archiveModule,
  markAsValidated,
  getModulesSummary
};
