import { sequelize } from '../database/database.js';
import { StripeWebhookLog } from '../models/StripeWebhookLog.js';
import { Tenant } from '../models/Tenant.js';
import { Op } from 'sequelize';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * 🏥 Health Check Controller
 * 
 * Verifica el estado de todos los servicios críticos del sistema
 */

/**
 * GET /api/health
 * Endpoint de health check completo
 */
export const getHealthStatus = async (req, res) => {
  const startTime = Date.now();
  const checks = {};
  let overallStatus = 'healthy';
  
  try {
    // ====================================
    // 1. Database Connection
    // ====================================
    try {
      await sequelize.authenticate();
      checks.database = {
        status: 'healthy',
        message: 'Database connection OK',
        responseTime: Date.now() - startTime
      };
    } catch (error) {
      checks.database = {
        status: 'unhealthy',
        message: error.message,
        responseTime: Date.now() - startTime
      };
      overallStatus = 'unhealthy';
    }
    
    // ====================================
    // 2. Stripe Connectivity
    // ====================================
    try {
      // Hacer una llamada simple a Stripe API
      await stripe.products.list({ limit: 1 });
      checks.stripe = {
        status: 'healthy',
        message: 'Stripe API connection OK',
        responseTime: Date.now() - startTime
      };
    } catch (error) {
      checks.stripe = {
        status: 'unhealthy',
        message: error.message,
        responseTime: Date.now() - startTime
      };
      overallStatus = 'degraded'; // No es crítico, sistema puede funcionar sin Stripe
    }
    
    // ====================================
    // 3. Failed Webhooks Count
    // ====================================
    try {
      const failedWebhooksCount = await StripeWebhookLog.count({
        where: {
          status: {
            [Op.in]: ['failed', 'failed_max_attempts']
          }
        }
      });
      
      const recentFailedCount = await StripeWebhookLog.count({
        where: {
          status: {
            [Op.in]: ['failed', 'failed_max_attempts']
          },
          created_at: {
            [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000) // Últimas 24 horas
          }
        }
      });
      
      checks.webhooks = {
        status: recentFailedCount > 10 ? 'warning' : 'healthy',
        message: `${recentFailedCount} failed webhooks in last 24h (${failedWebhooksCount} total)`,
        totalFailed: failedWebhooksCount,
        recentFailed: recentFailedCount,
        responseTime: Date.now() - startTime
      };
      
      if (recentFailedCount > 10) {
        overallStatus = overallStatus === 'unhealthy' ? 'unhealthy' : 'degraded';
      }
      
    } catch (error) {
      checks.webhooks = {
        status: 'unknown',
        message: error.message,
        responseTime: Date.now() - startTime
      };
    }
    
    // ====================================
    // 4. Trial System Status
    // ====================================
    try {
      const activeTrials = await Tenant.count({
        where: { status: 'trial' }
      });
      
      const expiredTrials = await Tenant.count({
        where: { status: 'expired' }
      });
      
      const activePaid = await Tenant.count({
        where: { status: 'active' }
      });
      
      // Trials próximos a expirar (3 días)
      const threeDaysFromNow = new Date();
      threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
      
      const expiringTrials = await Tenant.count({
        where: {
          status: 'trial',
          trial_ends_at: {
            [Op.lte]: threeDaysFromNow
          }
        }
      });
      
      checks.trialSystem = {
        status: 'healthy',
        message: 'Trial system operational',
        activeTrials,
        expiredTrials,
        activePaid,
        expiringIn3Days: expiringTrials,
        responseTime: Date.now() - startTime
      };
      
    } catch (error) {
      checks.trialSystem = {
        status: 'unhealthy',
        message: error.message,
        responseTime: Date.now() - startTime
      };
      overallStatus = 'unhealthy';
    }
    
    // ====================================
    // Response
    // ====================================
    const totalResponseTime = Date.now() - startTime;
    
    return res.status(overallStatus === 'unhealthy' ? 503 : 200).json({
      success: overallStatus !== 'unhealthy',
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      responseTime: totalResponseTime,
      checks
    });
    
  } catch (error) {
    console.error('❌ [Health Check] Error:', error);
    return res.status(503).json({
      success: false,
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      responseTime: Date.now() - startTime,
      error: error.message
    });
  }
};

/**
 * GET /api/health/simple
 * Endpoint de health check simple (solo retorna 200 si servidor está activo)
 */
export const getSimpleHealth = async (req, res) => {
  return res.status(200).json({
    success: true,
    status: 'ok',
    timestamp: new Date().toISOString()
  });
};
