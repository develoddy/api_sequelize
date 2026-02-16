import jwt from 'jsonwebtoken';

/**
 * Middleware para extraer y validar el tenant_id en las requests
 * 
 * Soporta múltiples métodos:
 * 1. Header: X-Tenant-Id
 * 2. Token JWT con tenant_id incluido
 * 3. Query param: ?tenant_id=123 (solo para desarrollo)
 */
export const requireTenant = (req, res, next) => {
  try {
    let tenantId = null;
    
    // Método 1: Header X-Tenant-Id
    if (req.headers['x-tenant-id']) {
      tenantId = parseInt(req.headers['x-tenant-id']);
    }
    
    // Método 2: Desde token JWT (si existe)
    if (!tenantId && req.headers['authorization']) {
      const token = req.headers['authorization'].replace('Bearer ', '');
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
        tenantId = decoded.tenant_id || decoded.tenantId;
      } catch (err) {
        // Token inválido, continuar con otros métodos
      }
    }
    
    // Método 3: Token específico de tenant (app-saas usa 'tenant_token')
    if (!tenantId && req.headers['token']) {
      try {
        const decoded = jwt.verify(req.headers['token'], process.env.JWT_SECRET || 'secret');
        tenantId = decoded.tenant_id || decoded.tenantId || decoded.id;
      } catch (err) {
        // Token inválido
      }
    }
    
    // Método 4: Query param (solo desarrollo)
    if (!tenantId && process.env.NODE_ENV !== 'production' && req.query.tenant_id) {
      tenantId = parseInt(req.query.tenant_id);
    }
    
    if (!tenantId || isNaN(tenantId)) {
      return res.status(403).json({
        success: false,
        error: 'Tenant ID requerido',
        message: 'Debe proporcionar X-Tenant-Id en los headers o un token válido'
      });
    }
    
    // Adjuntar tenant_id al request
    req.tenantId = tenantId;
    
    next();
  } catch (error) {
    console.error('[requireTenant] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Error al validar tenant',
      message: error.message
    });
  }
};

/**
 * Middleware opcional: No falla si no hay tenant_id
 * Útil para endpoints que pueden funcionar con o sin tenant
 */
export const optionalTenant = (req, res, next) => {
  try {
    let tenantId = null;
    
    if (req.headers['x-tenant-id']) {
      tenantId = parseInt(req.headers['x-tenant-id']);
    }
    
    if (!tenantId && req.headers['authorization']) {
      const token = req.headers['authorization'].replace('Bearer ', '');
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
        tenantId = decoded.tenant_id || decoded.tenantId;
      } catch (err) {
        // Continuar sin tenant
      }
    }
    
    req.tenantId = tenantId || null;
    next();
  } catch (error) {
    req.tenantId = null;
    next();
  }
};

/**
 * Middleware para validar que el agente pertenece al tenant
 * Se usa después de requireTenant
 */
export const requireTenantAgent = async (req, res, next) => {
  try {
    const { tenantId } = req;
    const agentEmail = req.user?.email || req.body?.agent_email;
    
    if (!agentEmail) {
      return res.status(403).json({
        success: false,
        error: 'Email del agente requerido'
      });
    }
    
    // Importar modelo dinámicamente para evitar circular dependency
    const { TenantAgent } = await import('../models/chat/TenantAgent.js');
    
    const agent = await TenantAgent.findByEmailAndTenant(agentEmail, tenantId);
    
    if (!agent || agent.status !== 'active') {
      return res.status(403).json({
        success: false,
        error: 'Agente no autorizado para este tenant'
      });
    }
    
    req.agent = agent;
    next();
  } catch (error) {
    console.error('[requireTenantAgent] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Error al validar agente',
      message: error.message
    });
  }
};
