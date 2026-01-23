import { Tenant } from '../models/Tenant.js';
import { Module } from '../models/Module.js';
import { TenantNote } from '../models/TenantNote.js';
import { TrackingEvent } from '../models/TrackingEvent.js';
import { Op } from 'sequelize';
import { sequelize } from '../database/database.js';

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
    
    // Validar que days sea un número positivo
    const daysNum = parseInt(days, 10);
    if (!days || isNaN(daysNum) || daysNum <= 0 || daysNum > 365) {
      return res.status(400).json({
        success: false,
        message: 'Debe especificar un número válido de días (1-365)'
      });
    }
    
    const tenant = await Tenant.findByPk(id);
    
    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant no encontrado'
      });
    }
    
    // Validar que el tenant esté en estado apropiado para extender trial
    if (tenant.status === 'active') {
      return res.status(400).json({
        success: false,
        message: 'No se puede extender trial de un tenant con subscripción activa'
      });
    }
    
    // Calculate new trial end date
    const currentTrialEnd = tenant.trial_ends_at ? new Date(tenant.trial_ends_at) : new Date();
    const newTrialEnd = new Date(currentTrialEnd);
    newTrialEnd.setDate(newTrialEnd.getDate() + daysNum);
    
    await tenant.update({
      trial_ends_at: newTrialEnd,
      status: 'trial', // Reset to trial if was expired
      trial_extended: true
    });
    
    console.log(`✅ [Admin] Trial extendido ${daysNum} días para tenant ${tenant.email} by ${req.user?.email}`);
    
    res.json({
      success: true,
      message: `Trial extendido por ${daysNum} días`,
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
    
    // Validar que el plan esté especificado
    if (!new_plan || typeof new_plan !== 'string' || new_plan.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Debe especificar un plan válido'
      });
    }
    
    // Lista de planes válidos
    const validPlans = ['trial', 'starter', 'pro', 'business', 'enterprise', 'free'];
    const normalizedPlan = new_plan.toLowerCase().trim();
    
    if (!validPlans.includes(normalizedPlan)) {
      return res.status(400).json({
        success: false,
        message: `Plan inválido. Planes válidos: ${validPlans.join(', ')}`
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
    
    // No permitir cambiar a trial si ya estuvo activo
    if (normalizedPlan === 'trial' && tenant.subscribed_at) {
      return res.status(400).json({
        success: false,
        message: 'No se puede cambiar a trial un tenant que ya tuvo subscripción activa'
      });
    }
    
    await tenant.update({
      plan: normalizedPlan
    });
    
    console.log(`✅ [Admin] Plan cambiado de ${oldPlan} a ${normalizedPlan} para tenant ${tenant.email} by ${req.user?.email}`);
    
    res.json({
      success: true,
      message: `Plan cambiado de ${oldPlan} a ${normalizedPlan}`,
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
    
    // Validar que la nota no esté vacía
    if (!note || typeof note !== 'string' || note.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Debe proporcionar una nota válida'
      });
    }
    
    // Validar longitud máxima (10,000 caracteres)
    if (note.length > 10000) {
      return res.status(400).json({
        success: false,
        message: 'La nota no puede exceder 10,000 caracteres'
      });
    }
    
    // Validar tipo de nota
    const validNoteTypes = ['general', 'support', 'billing', 'technical', 'cancellation'];
    const noteType = note_type || 'general';
    
    if (!validNoteTypes.includes(noteType)) {
      return res.status(400).json({
        success: false,
        message: `Tipo de nota inválido. Tipos válidos: ${validNoteTypes.join(', ')}`
      });
    }
    
    const tenant = await Tenant.findByPk(id);
    
    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant no encontrado'
      });
    }
    
    // Usar email del admin autenticado si está disponible
    const createdBy = req.user?.email || created_by || 'admin';
    
    const newNote = await TenantNote.create({
      tenant_id: id,
      note: note.trim(),
      note_type: noteType,
      created_by: createdBy,
      is_important: Boolean(is_important)
    });
    
    console.log(`✅ [Admin] Nota agregada a tenant ${tenant.email} by ${createdBy} (tipo: ${noteType})`);
    
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

/**
 * ========================================
 * TRACKING EVENTS MANAGEMENT
 * ========================================
 */

/**
 * Get tracking events with filters and pagination
 */
export const getTrackingEvents = async (req, res) => {
  try {
    const {
      module,
      event,
      session_id,
      user_id,
      tenant_id,
      date_from,
      date_to,
      page = 1,
      limit = 50
    } = req.query;

    // Build where clause
    const where = {};

    if (module) {
      where.module = module;
    }

    if (event) {
      where.event = event;
    }

    if (session_id) {
      where.session_id = session_id;
    }

    if (user_id) {
      where.user_id = user_id;
    }

    if (tenant_id) {
      where.tenant_id = parseInt(tenant_id);
    }

    // Date range filter
    if (date_from || date_to) {
      where.timestamp = {};
      if (date_from) {
        where.timestamp[Op.gte] = new Date(date_from);
      }
      if (date_to) {
        where.timestamp[Op.lte] = new Date(date_to);
      }
    }

    // Calculate offset
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Query events
    const { count, rows: events } = await TrackingEvent.findAndCountAll({
      where,
      order: [['timestamp', 'DESC']],
      limit: parseInt(limit),
      offset
    });

    // Parse JSON properties
    const eventsWithParsedProperties = events.map(event => {
      const eventData = event.toJSON();
      try {
        eventData.properties = JSON.parse(eventData.properties || '{}');
      } catch (e) {
        eventData.properties = {};
      }
      return eventData;
    });

    res.json({
      success: true,
      events: eventsWithParsedProperties,
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / parseInt(limit))
    });

  } catch (error) {
    console.error('❌ Error getting tracking events:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener eventos de tracking',
      error: error.message
    });
  }
};

/**
 * Get unique modules from tracking events
 */
export const getUniqueModules = async (req, res) => {
  try {
    const modules = await TrackingEvent.findAll({
      attributes: [[sequelize.fn('DISTINCT', sequelize.col('module')), 'module']],
      where: {
        module: { [Op.ne]: null }
      },
      raw: true
    });

    const moduleList = modules.map(m => m.module).filter(Boolean);

    res.json({
      success: true,
      modules: moduleList
    });

  } catch (error) {
    console.error('❌ Error getting unique modules:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener módulos únicos',
      error: error.message
    });
  }
};

/**
 * Get unique event types
 */
export const getUniqueEvents = async (req, res) => {
  try {
    const events = await TrackingEvent.findAll({
      attributes: [[sequelize.fn('DISTINCT', sequelize.col('event')), 'event']],
      raw: true
    });

    const eventList = events.map(e => e.event).filter(Boolean);

    res.json({
      success: true,
      events: eventList
    });

  } catch (error) {
    console.error('❌ Error getting unique events:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener tipos de eventos únicos',
      error: error.message
    });
  }
};

/**
 * Export tracking events to CSV
 */
export const exportTrackingEventsToCSV = async (req, res) => {
  try {
    const {
      module,
      event,
      session_id,
      user_id,
      tenant_id,
      date_from,
      date_to
    } = req.query;

    // Build where clause (same as getTrackingEvents)
    const where = {};

    if (module) where.module = module;
    if (event) where.event = event;
    if (session_id) where.session_id = session_id;
    if (user_id) where.user_id = user_id;
    if (tenant_id) where.tenant_id = parseInt(tenant_id);

    if (date_from || date_to) {
      where.timestamp = {};
      if (date_from) where.timestamp[Op.gte] = new Date(date_from);
      if (date_to) where.timestamp[Op.lte] = new Date(date_to);
    }

    // Get all events (no pagination for export)
    const events = await TrackingEvent.findAll({
      where,
      order: [['timestamp', 'DESC']],
      limit: 10000 // Limit to prevent memory issues
    });

    // Parse properties and flatten for CSV
    const csvData = events.map(event => {
      const eventData = event.toJSON();
      
      // Parse properties JSON
      let properties = {};
      try {
        properties = JSON.parse(eventData.properties || '{}');
      } catch (e) {
        properties = {};
      }

      return {
        id: eventData.id,
        event: eventData.event,
        properties: JSON.stringify(properties), // Keep as string for CSV
        session_id: eventData.session_id,
        user_id: eventData.user_id,
        tenant_id: eventData.tenant_id,
        module: eventData.module,
        source: eventData.source,
        user_agent: eventData.user_agent,
        ip_address: eventData.ip_address,
        timestamp: eventData.timestamp,
        created_at: eventData.created_at
      };
    });

    // Manual CSV generation (simple approach without dependencies)
    const headers = [
      'id',
      'event',
      'properties',
      'session_id',
      'user_id',
      'tenant_id',
      'module',
      'source',
      'user_agent',
      'ip_address',
      'timestamp',
      'created_at'
    ];

    // Escape CSV field (handle commas and quotes)
    const escapeCSVField = (field) => {
      if (field === null || field === undefined) return '';
      const str = String(field);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    // Build CSV string
    let csv = headers.join(',') + '\n';
    
    csvData.forEach(row => {
      const values = headers.map(header => escapeCSVField(row[header]));
      csv += values.join(',') + '\n';
    });

    // Set headers for file download
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=tracking-events-${Date.now()}.csv`);
    
    res.send(csv);

  } catch (error) {
    console.error('❌ Error exporting tracking events:', error);
    res.status(500).json({
      success: false,
      message: 'Error al exportar eventos',
      error: error.message
    });
  }
};
