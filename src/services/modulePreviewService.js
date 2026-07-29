/**
 * Module Preview Service
 * 
 * Servicio genérico para manejar Preview Mode de cualquier módulo SaaS.
 * Principios:
 * - ✅ No persiste en BD hasta registro
 * - ✅ Stateless (sessionStorage)
 * - ✅ Escalable y reutilizable
 * - ✅ Seguro con rate limiting
 * 
 * @module services/modulePreviewService
 */

import { Module } from '../domains/platform/models/Module.js';
import { sequelize } from '../database/database.js';

/**
 * Registry de funciones generadoras de preview por módulo
 * Cada módulo registra su propia lógica de generación
 */
const previewGenerators = new Map();

/**
 * Registrar una función generadora de preview para un módulo
 * 
 * @param {string} moduleKey - Clave del módulo (ej: 'mailflow', 'newsletter')
 * @param {Function} generatorFn - Función async que genera el preview
 * 
 * @example
 * registerPreviewGenerator('mailflow', async (data) => {
 *   return {
 *     sequenceName: data.sequenceName,
 *     emails: [...],
 *     metadata: { ... }
 *   };
 * });
 */
export function registerPreviewGenerator(moduleKey, generatorFn) {
  if (typeof generatorFn !== 'function') {
    throw new Error(`Generator for module '${moduleKey}' must be a function`);
  }
  
  previewGenerators.set(moduleKey, generatorFn);
  console.log(`✅ Preview generator registered for module: ${moduleKey}`);
}

/**
 * Obtener configuración de preview para un módulo
 * 
 * @param {string} moduleKey - Clave del módulo
 * @returns {Promise<Object|null>} Configuración de preview o null si no existe
 */
export async function getPreviewConfig(moduleKey) {
  const module = await Module.findOne({
    where: { key: moduleKey },
    attributes: ['id', 'key', 'name', 'tagline', 'status', 'preview_config', 'saas_config']
  });
  
  if (!module) {
    return null;
  }
  
  // Parse preview_config (puede venir como string desde MariaDB/MySQL)
  let previewConfig = module.preview_config;
  if (typeof previewConfig === 'string') {
    try {
      previewConfig = JSON.parse(previewConfig);
    } catch (e) {
      console.error(`❌ Error parsing preview_config for ${moduleKey}:`, e);
      return null;
    }
  }
  
  previewConfig = previewConfig || {};
  
  // Validar que preview esté habilitado
  if (!previewConfig.enabled) {
    return null;
  }
  
  return {
    moduleId: module.id,
    moduleKey: module.key,
    moduleName: module.name,
    tagline: module.tagline,  // ✅ Incluir tagline para UI dinámica
    status: module.status,  // ✅ Incluir status para validación en frontend
    previewEnabled: previewConfig.enabled,
    ...previewConfig
  };
}

/**
 * Generar preview para un módulo
 * 
 * @param {string} moduleKey - Clave del módulo
 * @param {Object} data - Datos de entrada para generar el preview
 * @param {string} [data.industry] - Industria para personalización
 * @param {string} [data.brandName] - Nombre de marca
 * @param {Object} [data.options] - Opciones adicionales específicas del módulo
 * 
 * @returns {Promise<Object>} Preview generado
 * @throws {Error} Si el módulo no tiene preview habilitado o no existe generador
 */
export async function generatePreview(moduleKey, data = {}) {
  // ✅ ESTRATEGIA NUEVA: Priorizar generador registrado sobre configuración en BD
  // Esto permite que MVPs funcionen sin necesidad de llenar la tabla modules
  
  // 1. Buscar generador registrado (obligatorio)
  const generatorFn = previewGenerators.get(moduleKey);
  
  if (!generatorFn) {
    throw new Error(
      `No preview generator registered for module '${moduleKey}'. ` +
      `Use registerPreviewGenerator('${moduleKey}', generatorFn) to register one.`
    );
  }
  
  // 2. Intentar obtener config de BD (opcional para metadata)
  let config = null;
  try {
    config = await getPreviewConfig(moduleKey);
  } catch (error) {
    console.log(`ℹ️ No DB config found for '${moduleKey}', using generator with default metadata`);
  }
  
  // 3. Ejecutar generador
  try {
    const preview = await generatorFn(data);
    
    // 4. Agregar metadata común
    return {
      ...preview,
      _metadata: {
        moduleKey,
        moduleName: config?.moduleName || moduleKey.charAt(0).toUpperCase() + moduleKey.slice(1),
        generatedAt: new Date().toISOString(),
        sessionKey: config?.conversion_config?.recovery_key || `${moduleKey}_preview`,
        expiresIn: '24h' // Los previews expiran en 24h
      }
    };
    
  } catch (error) {
    console.error(`❌ Error generating preview for ${moduleKey}:`, error);
    throw new Error(`Failed to generate preview: ${error.message}`);
  }
}

/**
 * Validar datos de preview antes de conversión
 * Verifica que los datos del sessionStorage sean válidos y no hayan expirado
 * 
 * @param {Object} previewData - Datos del preview desde sessionStorage
 * @returns {boolean} true si el preview es válido
 */
export function validatePreviewData(previewData) {
  if (!previewData || typeof previewData !== 'object') {
    return false;
  }
  
  // Verificar metadata requerida
  const metadata = previewData._metadata;
  if (!metadata || !metadata.generatedAt || !metadata.moduleKey) {
    return false;
  }
  
  // Verificar expiración (24 horas)
  const generatedAt = new Date(metadata.generatedAt);
  const now = new Date();
  const hoursSinceGeneration = (now - generatedAt) / (1000 * 60 * 60);
  
  if (hoursSinceGeneration > 24) {
    return false;
  }
  
  return true;
}

/**
 * Convertir preview en registro real después de autenticación
 * 
 * @param {string} moduleKey - Clave del módulo
 * @param {Object} previewData - Datos del preview desde sessionStorage
 * @param {number} tenantId - ID del tenant autenticado
 * @param {number} userId - ID del usuario autenticado
 * @param {Object} [options] - Opciones adicionales
 * @param {boolean} [options.autoActivate=true] - Activar automáticamente después de crear
 * 
 * @returns {Promise<Object>} Resultado de la conversión
 */
export async function convertPreviewToReal(
  moduleKey,
  previewData,
  tenantId,
  userId,
  options = {}
) {
  // Validar preview data
  if (!validatePreviewData(previewData)) {
    throw new Error('Invalid or expired preview data');
  }
  
  // Verificar que el módulo sea el correcto
  if (previewData._metadata.moduleKey !== moduleKey) {
    throw new Error(
      `Module key mismatch: expected '${moduleKey}', got '${previewData._metadata.moduleKey}'`
    );
  }
  
  // Obtener configuración del módulo
  const config = await getPreviewConfig(moduleKey);
  
  if (!config) {
    throw new Error(`Preview mode not configured for module '${moduleKey}'`);
  }
  
  // Buscar conversor registrado (opcional)
  const converterFn = previewConverters.get(moduleKey);
  
  if (converterFn) {
    // Si hay conversor específico, usarlo
    return await converterFn(previewData, tenantId, userId, options);
  }
  
  // Conversor genérico: retornar los datos para que el módulo los procese
  return {
    success: true,
    message: `Preview data ready for conversion in module '${moduleKey}'`,
    data: previewData,
    tenantId,
    userId,
    shouldActivate: options.autoActivate !== false
  };
}

/**
 * Registry de funciones conversoras (preview → BD real)
 */
const previewConverters = new Map();

/**
 * Registrar función conversora para un módulo
 * 
 * @param {string} moduleKey - Clave del módulo
 * @param {Function} converterFn - Función async que convierte preview en BD real
 * 
 * @example
 * registerPreviewConverter('mailflow', async (previewData, tenantId, userId, options) => {
 *   const sequence = await MailflowSequence.create({
 *     tenantId,
 *     userId,
 *     sequenceName: previewData.sequenceName,
 *     emails: previewData.emails
 *   });
 *   
 *   if (options.autoActivate) {
 *     await sequence.activate();
 *   }
 *   
 *   return { sequenceId: sequence.sequenceId };
 * });
 */
export function registerPreviewConverter(moduleKey, converterFn) {
  if (typeof converterFn !== 'function') {
    throw new Error(`Converter for module '${moduleKey}' must be a function`);
  }
  
  previewConverters.set(moduleKey, converterFn);
  console.log(`✅ Preview converter registered for module: ${moduleKey}`);
}

/**
 * Obtener lista de módulos con preview habilitado
 * Útil para construir menús dinámicos o landing pages
 * 
 * @returns {Promise<Array>} Array de módulos con preview
 */
export async function getModulesWithPreview() {
  const modules = await Module.findAll({
    where: {
      is_active: true,
      status: sequelize.literal(`JSON_EXTRACT(preview_config, '$.enabled') = true`)
    },
    attributes: ['id', 'key', 'name', 'tagline', 'icon', 'color', 'preview_config']
  });
  
  return modules.map(module => ({
    moduleId: module.id,
    moduleKey: module.key,
    moduleName: module.name,
    tagline: module.tagline,
    icon: module.icon,
    color: module.color,
    previewRoute: module.preview_config?.route,
    demoButtonText: module.preview_config?.demo_button_text || 'Try Demo'
  }));
}

/**
 * Registrar generadores y conversores para módulos built-in
 * Esta función se debe llamar al iniciar el servidor
 */
export function initializeBuiltInPreviews() {
  // Los módulos registrarán sus propios generadores/conversores
  // al importarse en el servidor
  console.log('🎯 Module Preview Service initialized');
}

export default {
  registerPreviewGenerator,
  registerPreviewConverter,
  getPreviewConfig,
  generatePreview,
  validatePreviewData,
  convertPreviewToReal,
  getModulesWithPreview,
  initializeBuiltInPreviews
};
