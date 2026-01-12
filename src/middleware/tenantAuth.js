import jwt from 'jsonwebtoken';
import { Tenant } from '../models/Tenant.js';

/**
 * Middleware: Autenticación de Tenants (clientes SaaS)
 * Verifica el JWT token y adjunta la info del tenant al request
 */
export const authenticateTenant = async (req, res, next) => {
  try {
    // Obtener token del header Authorization
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'No authorization token provided'
      });
    }

    const token = authHeader.substring(7); // Remover "Bearer "

    // Verificar token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');

    // Verificar que sea un token de tenant
    if (decoded.type !== 'tenant') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token type'
      });
    }

    // Verificar que el tenant existe
    const tenant = await Tenant.findByPk(decoded.tenantId);
    
    if (!tenant) {
      return res.status(401).json({
        success: false,
        error: 'Tenant not found'
      });
    }

    // Verificar que tiene acceso (trial no expirado o subscripción activa)
    if (!tenant.hasAccess()) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Your trial has expired or subscription is not active.',
        status: tenant.status,
        trial_expired: tenant.hasTrialExpired()
      });
    }

    // Adjuntar info del tenant al request
    req.tenant = {
      tenantId: tenant.id,
      email: tenant.email,
      moduleKey: tenant.module_key,
      plan: tenant.plan,
      status: tenant.status
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token expired'
      });
    }

    console.error('❌ Error in tenant authentication middleware:', error);
    return res.status(500).json({
      success: false,
      error: 'Authentication error'
    });
  }
};

/**
 * Middleware: Verificar acceso sin bloquear
 * Adjunta info del tenant si el token es válido, pero no bloquea si no lo es
 * Útil para endpoints que pueden funcionar con o sin autenticación
 */
export const optionalTenantAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No hay token, pero está OK (opcional)
      req.tenant = null;
      return next();
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');

    if (decoded.type === 'tenant') {
      const tenant = await Tenant.findByPk(decoded.tenantId);
      
      if (tenant) {
        req.tenant = {
          tenantId: tenant.id,
          email: tenant.email,
          moduleKey: tenant.module_key,
          plan: tenant.plan,
          status: tenant.status,
          hasAccess: tenant.hasAccess()
        };
      }
    }

    next();
  } catch (error) {
    // Error en el token, pero como es opcional, continuamos
    req.tenant = null;
    next();
  }
};
