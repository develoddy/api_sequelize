import { Tenant } from '../models/Tenant.js';
import { Module } from '../models/Module.js';
import { TenantNote } from '../models/TenantNote.js';
import { Op } from 'sequelize';

/**
 * Get all tenants with filtering options
 */
export const getAllTenants = async (req, res) => {
  try {
    const { status, module_key, plan, search } = req.query;
    
    // Build where clause
    const where = {};
    
    if (status) {
      where.status = status;
    }
    
    if (module_key) {
      where.module_key = module_key;
    }
    
    if (plan) {
      where.plan = plan;
    }
    
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } }
      ];
    }
    
    const tenants = await Tenant.findAll({
      where,
      include: [{
        model: Module,
        as: 'module',
        attributes: ['id', 'name', 'key', 'icon']
      }],
      order: [['created_at', 'DESC']]
    });
    
    res.json({
      success: true,
      tenants,
      total: tenants.length
    });
    
  } catch (error) {
    console.error('❌ Error getting tenants:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener la lista de tenants',
      error: error.message
    });
  }
};

/**
 * Get tenant by ID with all details
 */
export const getTenantById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const tenant = await Tenant.findByPk(id, {
      include: [
        {
          model: Module,
          as: 'module',
          attributes: ['id', 'name', 'key', 'icon', 'description']
        },
        {
          model: TenantNote,
          as: 'notes',
          order: [['created_at', 'DESC']],
          limit: 50
        }
      ]
    });
    
    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant no encontrado'
      });
    }
    
    res.json({
      success: true,
      tenant
    });
    
  } catch (error) {
    console.error('❌ Error getting tenant:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener el tenant',
      error: error.message
    });
  }
};

/**
 * Extend trial period
 */
export const extendTrial = async (req, res) => {
  try {
    const { id } = req.params;
    const { days } = req.body;
    
    if (!days || days <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Debe especificar el número de días a extender'
      });
    }
    
    const tenant = await Tenant.findByPk(id);
    
    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant no encontrado'
      });
    }
    
    // Calculate new trial end date
    const currentTrialEnd = tenant.trial_ends_at ? new Date(tenant.trial_ends_at) : new Date();
    const newTrialEnd = new Date(currentTrialEnd);
    newTrialEnd.setDate(newTrialEnd.getDate() + parseInt(days));
    
    await tenant.update({
      trial_ends_at: newTrialEnd,
      status: 'trial' // Reset to trial if was expired
    });
    
    res.json({
      success: true,
      message: `Trial extendido por ${days} días`,
      tenant
    });
    
  } catch (error) {
    console.error('❌ Error extending trial:', error);
    res.status(500).json({
      success: false,
      message: 'Error al extender el trial',
      error: error.message
    });
  }
};

/**
 * Cancel subscription
 */
export const cancelSubscription = async (req, res) => {
  try {
    const { id } = req.params;
    
    const tenant = await Tenant.findByPk(id);
    
    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant no encontrado'
      });
    }
    
    if (tenant.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Solo se pueden cancelar suscripciones activas'
      });
    }
    
    await tenant.update({
      status: 'cancelled',
      cancelled_at: new Date(),
      subscription_ends_at: new Date() // End immediately
    });
    
    res.json({
      success: true,
      message: 'Suscripción cancelada exitosamente',
      tenant
    });
    
  } catch (error) {
    console.error('❌ Error canceling subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cancelar la suscripción',
      error: error.message
    });
  }
};

/**
 * Suspend tenant account
 */
export const suspendTenant = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    const tenant = await Tenant.findByPk(id);
    
    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant no encontrado'
      });
    }
    
    await tenant.update({
      status: 'suspended'
    });
    
    res.json({
      success: true,
      message: 'Cuenta suspendida exitosamente',
      tenant,
      note: reason ? `Suspensión: ${reason}` : null
    });
    
  } catch (error) {
    console.error('❌ Error suspending tenant:', error);
    res.status(500).json({
      success: false,
      message: 'Error al suspender la cuenta',
      error: error.message
    });
  }
};

/**
 * Reactivate tenant account
 */
export const reactivateTenant = async (req, res) => {
  try {
    const { id } = req.params;
    
    const tenant = await Tenant.findByPk(id);
    
    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant no encontrado'
      });
    }
    
    // Determine new status based on subscription state
    let newStatus = 'trial';
    if (tenant.stripe_subscription_id) {
      newStatus = 'active';
    } else if (tenant.trial_ends_at && new Date(tenant.trial_ends_at) > new Date()) {
      newStatus = 'trial';
    }
    
    await tenant.update({
      status: newStatus
    });
    
    res.json({
      success: true,
      message: 'Cuenta reactivada exitosamente',
      tenant
    });
    
  } catch (error) {
    console.error('❌ Error reactivating tenant:', error);
    res.status(500).json({
      success: false,
      message: 'Error al reactivar la cuenta',
      error: error.message
    });
  }
};

/**
 * Change tenant plan
 */
export const changePlan = async (req, res) => {
  try {
    const { id } = req.params;
    const { new_plan } = req.body;
    
    if (!new_plan) {
      return res.status(400).json({
        success: false,
        message: 'Debe especificar el nuevo plan'
      });
    }
    
    const tenant = await Tenant.findByPk(id);
    
    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant no encontrado'
      });
    }
    
    const oldPlan = tenant.plan;
    
    await tenant.update({
      plan: new_plan
    });
    
    res.json({
      success: true,
      message: `Plan cambiado de ${oldPlan} a ${new_plan}`,
      tenant
    });
    
  } catch (error) {
    console.error('❌ Error changing plan:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cambiar el plan',
      error: error.message
    });
  }
};

/**
 * Add admin note to tenant
 */
/**
 * Add admin note to tenant
 */
export const addNote = async (req, res) => {
  try {
    const { id } = req.params;
    const { note, created_by, note_type, is_important } = req.body;
    
    if (!note) {
      return res.status(400).json({
        success: false,
        message: 'Debe proporcionar una nota'
      });
    }
    
    const tenant = await Tenant.findByPk(id);
    
    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant no encontrado'
      });
    }
    
    const newNote = await TenantNote.create({
      tenant_id: id,
      note,
      note_type: note_type || 'general',
      created_by: created_by || 'admin',
      is_important: is_important || false
    });
    
    res.json({
      success: true,
      message: 'Nota agregada exitosamente',
      note: newNote
    });
    
  } catch (error) {
    console.error('❌ Error adding note:', error);
    res.status(500).json({
      success: false,
      message: 'Error al agregar la nota',
      error: error.message
    });
  }
};

/**
 * Get notes for tenant
 */
export const getTenantNotes = async (req, res) => {
  try {
    const { id } = req.params;
    
    const notes = await TenantNote.findAll({
      where: { tenant_id: id },
      order: [['created_at', 'DESC']]
    });
    
    res.json({
      success: true,
      notes
    });
    
  } catch (error) {
    console.error('❌ Error getting notes:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener las notas',
      error: error.message
    });
  }
};

/**
 * Delete tenant (soft delete recommended)
 */
export const deleteTenant = async (req, res) => {
  try {
    const { id } = req.params;
    
    const tenant = await Tenant.findByPk(id);
    
    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant no encontrado'
      });
    }
    
    // Soft delete by updating status
    await tenant.update({
      status: 'deleted',
      deleted_at: new Date()
    });
    
    // Or hard delete (uncomment if needed)
    // await tenant.destroy();
    
    res.json({
      success: true,
      message: 'Tenant eliminado exitosamente'
    });
    
  } catch (error) {
    console.error('❌ Error deleting tenant:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar el tenant',
      error: error.message
    });
  }
};
