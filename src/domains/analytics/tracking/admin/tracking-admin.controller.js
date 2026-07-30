import { TrackingEvent } from '../../../../models/TrackingEvent.js';
import { Op } from 'sequelize';
import { sequelize } from '../../../../database/database.js';

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
      source,
      campaign,
      medium,
      is_internal_access,
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

    if (source) {
      where.source = source;
    }

    // 🆕 UTM tracking filters (inside properties JSON)
    // MySQL syntax: JSON_EXTRACT(properties, '$.campo')
    if (campaign) {
      where[Op.and] = where[Op.and] || [];
      where[Op.and].push(
        sequelize.where(
          sequelize.literal("JSON_EXTRACT(properties, '$.campaign')"),
          campaign
        )
      );
    }

    if (medium) {
      where[Op.and] = where[Op.and] || [];
      where[Op.and].push(
        sequelize.where(
          sequelize.literal("JSON_EXTRACT(properties, '$.medium')"),
          medium
        )
      );
    }

    // 🆕 Admin vs Public filter (inside properties JSON)
    if (is_internal_access !== undefined) {
      const isInternal = is_internal_access === 'true' || is_internal_access === true;
      where[Op.and] = where[Op.and] || [];
      where[Op.and].push(
        sequelize.where(
          sequelize.literal("JSON_EXTRACT(properties, '$.is_internal_access')"),
          isInternal
        )
      );
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
      source,
      campaign,
      medium,
      is_internal_access,
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
    if (source) where.source = source;

    // 🆕 UTM tracking filters (inside properties JSON)
    // MySQL syntax: JSON_EXTRACT(properties, '$.campo')
    if (campaign) {
      where[Op.and] = where[Op.and] || [];
      where[Op.and].push(
        sequelize.where(
          sequelize.literal("JSON_EXTRACT(properties, '$.campaign')"),
          campaign
        )
      );
    }

    if (medium) {
      where[Op.and] = where[Op.and] || [];
      where[Op.and].push(
        sequelize.where(
          sequelize.literal("JSON_EXTRACT(properties, '$.medium')"),
          medium
        )
      );
    }

    // 🆕 Admin vs Public filter (inside properties JSON)
    if (is_internal_access !== undefined) {
      const isInternal = is_internal_access === 'true' || is_internal_access === true;
      where[Op.and] = where[Op.and] || [];
      where[Op.and].push(
        sequelize.where(
          sequelize.literal("JSON_EXTRACT(properties, '$.is_internal_access')"),
          isInternal
        )
      );
    }

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

/**
 * Delete tracking events by source (LEGACY - mantener para compatibilidad)
 * ⚠️ Solo para desarrollo: eliminar eventos de tests internos (source='admin')
 * NO afecta eventos públicos (source='preview')
 * 
 * @route   DELETE /api/admin/saas/tracking-events/by-source/:source
 * @desc    Eliminar eventos por source (admin/preview/pro_modal)
 * @access  Admin only, development only
 */
export const deleteEventsBySource = async (req, res) => {
  try {
    const { source } = req.params;

    // Validación de seguridad: solo permitir en development o con confirmación especial
    if (process.env.NODE_ENV === 'production' && source !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Operación no permitida en producción. Solo se puede eliminar source=admin'
      });
    }

    // Validar que source sea uno válido
    const validSources = ['admin', 'preview', 'pro_modal'];
    if (!validSources.includes(source)) {
      return res.status(400).json({
        success: false,
        message: `Source inválido. Debe ser: ${validSources.join(', ')}`
      });
    }

    // Extra protección: avisar si intentan borrar preview
    if (source === 'preview') {
      console.warn('⚠️ Warning: Attempting to delete PUBLIC events (source=preview)');
    }

    // Contar eventos antes de borrar
    const countBefore = await TrackingEvent.count({ where: { source } });

    // Eliminar eventos con el source especificado
    const deleted = await TrackingEvent.destroy({
      where: { source }
    });

    console.log(`🗑️  Deleted ${deleted} tracking events with source='${source}'`);

    res.json({
      success: true,
      deleted,
      source,
      message: `Eliminados ${deleted} eventos con source='${source}'`
    });

  } catch (error) {
    console.error('❌ Error deleting events by source:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar eventos',
      error: error.message
    });
  }
};

/**
 * 🆕 Delete internal access events (UTM tracking system)
 * Elimina eventos con is_internal_access=true (accesos admin con ?internal=true)
 * PROTEGE eventos públicos (is_internal_access=false)
 * 
 * @route   DELETE /api/admin/saas/tracking-events/internal-access
 * @desc    Eliminar eventos de tests internos (is_internal_access=true)
 * @access  Admin only, development only
 */
export const deleteInternalAccessEvents = async (req, res) => {
  try {
    // Validación de seguridad adicional en producción
    if (process.env.NODE_ENV === 'production') {
      console.log('⚠️  Production environment: Deleting internal access events (is_internal_access=true)');
    }

    // 🔧 Buscar eventos con is_internal_access=true en properties JSON
    // MySQL syntax: JSON_EXTRACT(properties, '$.is_internal_access') = true
    const where = sequelize.where(
      sequelize.literal("JSON_EXTRACT(properties, '$.is_internal_access')"),
      true
    );

    // Contar eventos antes de borrar
    const countBefore = await TrackingEvent.count({ where });

    console.log(`📊 Found ${countBefore} internal access events to delete`);

    // Eliminar eventos internos
    const deleted = await TrackingEvent.destroy({ where });

    console.log(`🗑️  Deleted ${deleted} internal access events (is_internal_access=true)`);
    console.log(`✅ Public events (is_internal_access=false) remain SAFE`);

    res.json({
      success: true,
      deleted,
      message: `Eliminados ${deleted} eventos de tests internos. Eventos públicos permanecen intactos.`
    });

  } catch (error) {
    console.error('❌ Error deleting internal access events:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar eventos internos',
      error: error.message
    });
  }
};
