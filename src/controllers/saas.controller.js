import { Tenant } from '../models/Tenant.js';
import { Module } from '../models/Module.js';
import { User } from '../models/User.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Op } from 'sequelize';

/**
 * Controller: SaaS
 * Gestión de tenants (clientes SaaS), trials y subscripciones
 */

/**
 * POST /api/saas/trial/start
 * Iniciar trial gratuito para un módulo SaaS
 * 
 * Body: {
 *   name: string,
 *   email: string,
 *   password: string,
 *   moduleKey: string,
 *   plan: string (opcional, default: 'trial')
 * }
 */
export const startTrial = async (req, res) => {
  try {
    const { name, email, password, moduleKey, plan } = req.body;

    // Validar campos requeridos
    if (!name || !email || !password || !moduleKey) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, email, password, moduleKey'
      });
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format'
      });
    }

    // Verificar que el módulo existe y es tipo SaaS
    const module = await Module.findOne({ 
      where: { 
        key: moduleKey,
        type: 'saas',
        is_active: true,
        status: ['testing', 'live']
      } 
    });

    if (!module) {
      return res.status(404).json({
        success: false,
        error: 'SaaS module not found or not available'
      });
    }

    // Verificar si el email ya tiene un tenant activo para este módulo
    const existingTenant = await Tenant.findOne({
      where: {
        email,
        module_key: moduleKey,
        status: ['trial', 'active']
      }
    });

    if (existingTenant) {
      return res.status(409).json({
        success: false,
        error: 'You already have an active trial or subscription for this module'
      });
    }

    // Hashear password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Obtener días de trial del módulo
    const trialDays = module.saas_config?.trial_days || 14;
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + trialDays);

    // Crear tenant
    const tenant = await Tenant.create({
      name,
      email,
      password: hashedPassword,
      module_key: moduleKey,
      plan: plan || 'trial',
      status: 'trial',
      trial_ends_at: trialEndsAt,
      trial_extended: false,
      settings: {},
      metadata: {
        signup_date: new Date(),
        user_agent: req.headers['user-agent'],
        ip: req.ip
      }
    });

    // Generar JWT token para auto-login
    const token = jwt.sign(
      { 
        tenantId: tenant.id, 
        email: tenant.email,
        moduleKey: tenant.module_key,
        type: 'tenant'
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '30d' }
    );

    console.log(`✅ Trial started: ${tenant.email} for ${moduleKey} (${trialDays} days)`);

    res.status(201).json({
      success: true,
      message: `Trial started successfully! You have ${trialDays} days of free access.`,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        email: tenant.email,
        module_key: tenant.module_key,
        plan: tenant.plan,
        status: tenant.status,
        trial_ends_at: tenant.trial_ends_at,
        days_remaining: tenant.getDaysRemainingInTrial()
      },
      token,
      dashboard_url: module.saas_config?.dashboard_route 
        ? `/app/${module.saas_config.dashboard_route}` 
        : `/app/${moduleKey}`
    });
  } catch (error) {
    console.error('❌ Error starting trial:', error);
    res.status(500).json({
      success: false,
      error: 'Error starting trial',
      details: error.message
    });
  }
};

/**
 * POST /api/saas/login
 * Login de tenant (cliente SaaS)
 * 
 * Body: {
 *   email: string,
 *   password: string,
 *   moduleKey: string
 * }
 */
export const loginTenant = async (req, res) => {
  try {
    const { email, password, moduleKey } = req.body;

    // Validar campos
    if (!email || !password || !moduleKey) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: email, password, moduleKey'
      });
    }

    // Buscar tenant
    const tenant = await Tenant.findOne({
      where: {
        email,
        module_key: moduleKey
      }
    });

    if (!tenant) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Verificar password
    const validPassword = await bcrypt.compare(password, tenant.password);
    if (!validPassword) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Verificar si tiene acceso
    if (!tenant.hasAccess()) {
      return res.status(403).json({
        success: false,
        error: tenant.status === 'trial' && tenant.hasTrialExpired()
          ? 'Your trial has expired. Please subscribe to continue.'
          : 'Your subscription is not active. Please contact support.'
      });
    }

    // Generar JWT token
    const token = jwt.sign(
      { 
        tenantId: tenant.id, 
        email: tenant.email,
        moduleKey: tenant.module_key,
        type: 'tenant'
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '30d' }
    );

    // Obtener módulo para dashboard_url
    const module = await Module.findOne({ where: { key: moduleKey } });

    console.log(`✅ Tenant logged in: ${tenant.email} (${moduleKey})`);

    res.json({
      success: true,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        email: tenant.email,
        module_key: tenant.module_key,
        plan: tenant.plan,
        status: tenant.status,
        trial_ends_at: tenant.trial_ends_at,
        subscribed_at: tenant.subscribed_at,
        days_remaining: tenant.status === 'trial' ? tenant.getDaysRemainingInTrial() : null
      },
      token,
      dashboard_url: module?.saas_config?.dashboard_route 
        ? `/app/${module.saas_config.dashboard_route}` 
        : `/app/${moduleKey}`
    });
  } catch (error) {
    console.error('❌ Error logging in tenant:', error);
    res.status(500).json({
      success: false,
      error: 'Error logging in',
      details: error.message
    });
  }
};

/**
 * GET /api/saas/check-access
 * Verificar si el tenant tiene acceso al módulo
 * Requiere autenticación (token JWT)
 */
export const checkAccess = async (req, res) => {
  try {
    const { tenantId } = req.tenant; // Del middleware de autenticación

    const tenant = await Tenant.findByPk(tenantId);

    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: 'Tenant not found'
      });
    }

    const hasAccess = tenant.hasAccess();

    res.json({
      success: true,
      hasAccess,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        email: tenant.email,
        module_key: tenant.module_key,
        plan: tenant.plan,
        status: tenant.status,
        trial_ends_at: tenant.trial_ends_at,
        subscribed_at: tenant.subscribed_at,
        days_remaining: tenant.status === 'trial' ? tenant.getDaysRemainingInTrial() : null,
        is_on_trial: tenant.isOnTrial()
      }
    });
  } catch (error) {
    console.error('❌ Error checking access:', error);
    res.status(500).json({
      success: false,
      error: 'Error checking access'
    });
  }
};

/**
 * GET /api/saas/me
 * Obtener información del tenant autenticado
 */
export const getTenantProfile = async (req, res) => {
  try {
    const { tenantId } = req.tenant;

    const tenant = await Tenant.findByPk(tenantId);

    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: 'Tenant not found'
      });
    }

    res.json({
      success: true,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        email: tenant.email,
        module_key: tenant.module_key,
        plan: tenant.plan,
        status: tenant.status,
        trial_ends_at: tenant.trial_ends_at,
        trial_extended: tenant.trial_extended,
        subscribed_at: tenant.subscribed_at,
        cancelled_at: tenant.cancelled_at,
        subscription_ends_at: tenant.subscription_ends_at,
        settings: tenant.settings,
        created_at: tenant.created_at,
        updated_at: tenant.updated_at,
        // Helper info
        has_access: tenant.hasAccess(),
        is_on_trial: tenant.isOnTrial(),
        days_remaining: tenant.status === 'trial' ? tenant.getDaysRemainingInTrial() : null
      }
    });
  } catch (error) {
    console.error('❌ Error getting tenant profile:', error);
    res.status(500).json({
      success: false,
      error: 'Error getting profile'
    });
  }
};

/**
 * POST /api/saas/subscribe
 * Convertir trial a subscripción pagada
 * 
 * Body: {
 *   plan: string,
 *   stripeSubscriptionId: string,
 *   stripePriceId: string
 * }
 */
export const subscribeToModule = async (req, res) => {
  try {
    const { tenantId } = req.tenant;
    const { plan, stripeSubscriptionId, stripePriceId } = req.body;

    if (!plan || !stripeSubscriptionId || !stripePriceId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: plan, stripeSubscriptionId, stripePriceId'
      });
    }

    const tenant = await Tenant.findByPk(tenantId);

    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: 'Tenant not found'
      });
    }

    // Convertir a subscripción
    await tenant.convertToSubscription(plan, stripeSubscriptionId, stripePriceId);

    console.log(`✅ Tenant subscribed: ${tenant.email} to ${plan}`);

    res.json({
      success: true,
      message: 'Subscription activated successfully!',
      tenant: {
        id: tenant.id,
        email: tenant.email,
        plan: tenant.plan,
        status: tenant.status,
        subscribed_at: tenant.subscribed_at
      }
    });
  } catch (error) {
    console.error('❌ Error subscribing tenant:', error);
    res.status(500).json({
      success: false,
      error: 'Error activating subscription'
    });
  }
};

/**
 * POST /api/saas/cancel
 * Cancelar subscripción (mantiene acceso hasta el final del periodo)
 */
export const cancelSubscription = async (req, res) => {
  try {
    const { tenantId } = req.tenant;

    const tenant = await Tenant.findByPk(tenantId);

    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: 'Tenant not found'
      });
    }

    if (tenant.status !== 'active') {
      return res.status(400).json({
        success: false,
        error: 'No active subscription to cancel'
      });
    }

    // Fecha de fin: 30 días desde hoy (ciclo de facturación)
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30);

    await tenant.cancelSubscription(endDate);

    console.log(`✅ Subscription cancelled: ${tenant.email}`);

    res.json({
      success: true,
      message: 'Subscription cancelled. You will have access until the end of the billing period.',
      tenant: {
        id: tenant.id,
        email: tenant.email,
        status: tenant.status,
        cancelled_at: tenant.cancelled_at,
        subscription_ends_at: tenant.subscription_ends_at
      }
    });
  } catch (error) {
    console.error('❌ Error cancelling subscription:', error);
    res.status(500).json({
      success: false,
      error: 'Error cancelling subscription'
    });
  }
};
