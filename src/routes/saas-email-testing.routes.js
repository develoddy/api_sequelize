import express from 'express';
import { 
  sendTrialWelcomeEmail,
  sendTrialExpiringEmail,
  sendTrialExpiredEmail,
  sendPaymentSuccessEmail,
  sendSubscriptionCancelledEmail,
  sendAccessLostEmail,
  testEmailConfiguration
} from '../controllers/saas-email.controller.js';
import { runTrialNotificationsNow } from '../cron/trial-notifications.cron.js';
import { Tenant } from '../models/Tenant.js';

const router = express.Router();

/**
 * 🧪 TESTING ROUTES FOR SAAS EMAIL SYSTEM
 * Solo para desarrollo y testing
 */

// Get all tenants for testing
router.get('/tenants', async (req, res) => {
  try {
    const tenants = await Tenant.findAll({
      attributes: [
        'id',
        'name',
        'email',
        'module_key',
        'plan',
        'trial_ends_at',
        'stripe_subscription_id',
        'stripe_customer_id',
        'status',
        'created_at'
      ],
      order: [['created_at', 'DESC']],
      limit: 50
    });

    res.json({
      success: true,
      tenants: tenants,
      total: tenants.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Test SMTP configuration
router.get('/test-smtp', async (req, res) => {
  try {
    const result = await testEmailConfiguration();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Send trial welcome email
router.post('/send-trial-welcome/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;
    await sendTrialWelcomeEmail(Number(tenantId));
    res.json({ success: true, message: 'Trial welcome email sent' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Send trial expiring email
router.post('/send-trial-expiring/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;
    await sendTrialExpiringEmail(Number(tenantId));
    res.json({ success: true, message: 'Trial expiring email sent' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Send trial expired email
router.post('/send-trial-expired/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;
    await sendTrialExpiredEmail(Number(tenantId));
    res.json({ success: true, message: 'Trial expired email sent' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Send payment success email
router.post('/send-payment-success/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { amount } = req.body;
    await sendPaymentSuccessEmail(Number(tenantId), { amount });
    res.json({ success: true, message: 'Payment success email sent' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Send subscription cancelled email
router.post('/send-subscription-cancelled/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;
    await sendSubscriptionCancelledEmail(Number(tenantId));
    res.json({ success: true, message: 'Subscription cancelled email sent' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Send access lost email
router.post('/send-access-lost/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;
    await sendAccessLostEmail(Number(tenantId));
    res.json({ success: true, message: 'Access lost email sent' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Run trial notifications cron manually
router.post('/run-trial-notifications', async (req, res) => {
  try {
    const result = await runTrialNotificationsNow();
    res.json({ 
      success: true, 
      message: 'Trial notifications cron executed',
      result
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
