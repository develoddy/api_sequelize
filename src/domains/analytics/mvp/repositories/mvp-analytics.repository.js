import { Op } from 'sequelize';

import { TrackingEvent } from '../../../../models/TrackingEvent.js';
import { Module } from '../../../platform/models/Module.js';

/**
 * Buscar los datos necesarios de un módulo para analytics.
 */
async function findModuleByKey(moduleKey) {
  return Module.findOne({
    where: {
      key: moduleKey
    },
    attributes: [
      'id',
      'key',
      'name',
      'status',
      'module_type',
      'concept_name',
      'phase_order',
      'parent_module_id',
      'launched_at',
      'validation_days',
      'validation_target_sales'
    ]
  });
}

/**
 * Obtener eventos públicos de usuarios reales para analytics.
 */
async function findPublicTrackingEvents(moduleKey, dateFrom) {
  return TrackingEvent.findAll({
    where: {
      module: moduleKey,
      timestamp: {
        [Op.gte]: dateFrom
      },
      source: {
        [Op.notIn]: ['admin', 'internal']
      },
      [Op.or]: [
        {
          user_agent: null
        },
        {
          user_agent: {
            [Op.and]: [
              { [Op.notLike]: '%Googlebot%' },
              { [Op.notLike]: '%googlebot%' },
              { [Op.notLike]: '%bingbot%' },
              { [Op.notLike]: '%bot/%' },
              { [Op.notLike]: '%crawler%' },
              { [Op.notLike]: '%Crawler%' },
              { [Op.notLike]: '%spider%' },
              { [Op.notLike]: '%Spider%' },
              { [Op.notLike]: '%slurp%' },
              { [Op.notLike]: '%crawl%' }
            ]
          }
        }
      ]
    },
    order: [
      ['timestamp', 'ASC']
    ]
  });
}

/**
 * Obtener módulos activos que participan en analytics.
 */
async function findActiveAnalyticsModules() {
  return Module.findAll({
    where: {
      status: {
        [Op.in]: ['testing', 'live']
      },
      is_active: true
    },
    attributes: [
      'key',
      'name',
      'status',
      'launched_at',
      'validation_days',
      'validation_target_sales'
    ],
    order: [
      ['created_at', 'DESC']
    ]
  });
}

export {
  findModuleByKey,
  findPublicTrackingEvents,
  findActiveAnalyticsModules
};