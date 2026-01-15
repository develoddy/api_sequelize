/**
 * Module Preview Controller
 * 
 * Controlador genérico para endpoints públicos de preview.
 * Maneja generación, validación y conversión de previews para cualquier módulo.
 * 
 * @module controllers/modulePreviewController
 */

import modulePreviewService from '../services/modulePreviewService.js';
import { rateLimit } from 'express-rate-limit';

/**
 * Rate limiter para endpoints de preview
 * Previene abuso de endpoints públicos
 */
export const previewRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // 10 requests por IP
  message: {
    success: false,
    error: 'Too many preview requests. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * GET /api/modules/preview/available
 * 
 * Obtener lista de módulos con preview habilitado
 * Público, sin autenticación
 */
export async function getAvailablePreviews(req, res) {
  try {
    const modules = await modulePreviewService.getModulesWithPreview();
    
    res.json({
      success: true,
      count: modules.length,
      modules
    });
    
  } catch (error) {
    console.error('❌ Error getting available previews:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch available previews'
    });
  }
}

/**
 * POST /api/modules/:module_key/preview/generate
 * 
 * Generar preview para un módulo específico
 * Público, sin autenticación, con rate limiting
 * 
 * Body:
 * {
 *   industry: 'ecommerce',
 *   brandName: 'My Store',
 *   options: { ... }  // Opciones específicas del módulo
 * }
 */
export async function generateModulePreview(req, res) {
  try {
    const { module_key } = req.params;
    const data = req.body;
    
    // Validar que module_key sea válido (seguridad)
    if (!/^[a-z0-9-]+$/i.test(module_key)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid module key format'
      });
    }
    
    // Generar preview
    const preview = await modulePreviewService.generatePreview(module_key, data);
    
    res.json({
      success: true,
      preview,
      instructions: {
        storage: `Store this preview in sessionStorage['${preview._metadata.sessionKey}']`,
        expiration: preview._metadata.expiresIn,
        nextStep: 'Register or login to convert this preview into a real configuration'
      }
    });
    
  } catch (error) {
    console.error(`❌ Error generating preview for ${req.params.module_key}:`, error);
    
    // Diferenciar entre error de configuración y error del sistema
    if (error.message.includes('not enabled') || error.message.includes('No preview generator')) {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to generate preview'
    });
  }
}

/**
 * GET /api/modules/:module_key/preview/config
 * 
 * Obtener configuración de preview de un módulo
 * Público, sin autenticación
 */
export async function getModulePreviewConfig(req, res) {
  try {
    const { module_key } = req.params;
    
    const config = await modulePreviewService.getPreviewConfig(module_key);
    
    if (!config) {
      return res.status(404).json({
        success: false,
        error: `Preview mode not available for module '${module_key}'`
      });
    }
    
    res.json({
      success: true,
      config
    });
    
  } catch (error) {
    console.error(`❌ Error getting preview config for ${req.params.module_key}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch preview configuration'
    });
  }
}

/**
 * POST /api/modules/:module_key/preview/convert
 * 
 * Convertir preview en configuración real después de autenticación
 * Requiere autenticación (TenantAuthMiddleware)
 * 
 * Body:
 * {
 *   previewData: { ... },  // Datos del sessionStorage
 *   autoActivate: true     // Opcional
 * }
 */
export async function convertPreviewToReal(req, res) {
  try {
    const { module_key } = req.params;
    const { previewData, autoActivate = true } = req.body;
    
    // Validar autenticación (debe estar en req.user y req.tenant)
    if (!req.user || !req.tenant) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required to convert preview'
      });
    }
    
    // Validar que haya previewData
    if (!previewData) {
      return res.status(400).json({
        success: false,
        error: 'Preview data is required'
      });
    }
    
    // Convertir preview a configuración real
    const result = await modulePreviewService.convertPreviewToReal(
      module_key,
      previewData,
      req.tenant.id,
      req.user.id,
      { autoActivate }
    );
    
    res.json({
      success: true,
      message: 'Preview converted successfully',
      result
    });
    
  } catch (error) {
    console.error(`❌ Error converting preview for ${req.params.module_key}:`, error);
    
    // Errores de validación
    if (error.message.includes('Invalid or expired')) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to convert preview'
    });
  }
}

/**
 * POST /api/modules/:module_key/preview/validate
 * 
 * Validar datos de preview sin convertir
 * Público, sin autenticación
 * 
 * Body:
 * {
 *   previewData: { ... }
 * }
 */
export async function validatePreview(req, res) {
  try {
    const { previewData } = req.body;
    
    if (!previewData) {
      return res.status(400).json({
        success: false,
        error: 'Preview data is required'
      });
    }
    
    const isValid = modulePreviewService.validatePreviewData(previewData);
    
    res.json({
      success: true,
      valid: isValid,
      message: isValid 
        ? 'Preview data is valid' 
        : 'Preview data is invalid or expired'
    });
    
  } catch (error) {
    console.error('❌ Error validating preview:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate preview'
    });
  }
}

export default {
  getAvailablePreviews,
  generateModulePreview,
  getModulePreviewConfig,
  convertPreviewToReal,
  validatePreview,
  previewRateLimiter
};
