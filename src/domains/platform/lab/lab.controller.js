import { Op } from 'sequelize';
import { Module } from '../models/Module.js';

/**
 * Normaliza campos JSON almacenados en MySQL.
 * Devuelve un array vacío si el valor no es válido.
 */
function parseJsonArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
}


/**
 * GET /api/lab/experiments
 *
 * Catálogo público de experimentos publicados en LujanDev Lab.
 * Independiente de las métricas de tracción y del sistema de previews.
 */
export async function listExperiments(req, res) {
  try {
    const modules = await Module.findAll({
      where: {
        is_active: true,
        show_in_store: true,
        status: {
          [Op.in]: ['testing', 'live']
        }
      },
      attributes: [
        'key',
        'name',
        'tagline',
        'description',
        'icon',
        'color',
        'status',
        'screenshots',
        'features'
      ],
      order: [['name', 'ASC']]
    });

    const experiments = modules.map((module) => ({
      key: module.key,
      name: module.name,
      tagline: module.tagline,
      description: module.description,
      icon: module.icon,
      color: module.color,
      status: module.status,
      screenshots: parseJsonArray(module.screenshots),
      features: parseJsonArray(module.features)
    }));

    return res.json({
      success: true,
      count: experiments.length,
      experiments
    });
  } catch (error) {
    console.error('Error fetching Lab experiments:', error);

    return res.status(500).json({
      success: false,
      error: 'Failed to fetch Lab experiments'
    });
  }
}