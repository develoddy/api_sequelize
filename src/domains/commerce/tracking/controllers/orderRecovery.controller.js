import {
  resolveGuestOrderRecovery
} from '../services/orderRecovery.service.js';

const recoveryResponse = {
  success: true,
  message: 'If the details match an eligible order, a recovery email will be sent.'
};

const MAX_ACTIVE_RECOVERIES = 5;

export function createOrderRecoveryController({
  sendRecoveryEmail,
  resolveRecovery = resolveGuestOrderRecovery
} = {}) {
  if (typeof sendRecoveryEmail !== 'function') {
    throw new TypeError('Recovery email sender is required');
  }

  let activeRecoveries = 0;

  async function processRecovery(input) {
    try {
      const recovery = await resolveRecovery(input);

      if (recovery) {
        const result = await sendRecoveryEmail(recovery);

        if (result?.success !== true) {
          console.error('[OrderRecovery] Email delivery failed');
        }
      }
    } catch {
      console.error('[OrderRecovery] Recovery request failed');
    } finally {
      activeRecoveries--;
    }
  }

  return function recoverOrder(req, res) {
    res.set('Cache-Control', 'no-store');
    res.set('Referrer-Policy', 'no-referrer');

    const input = {
      orderId: req.body?.orderId,
      email: req.body?.email
    };

    if (activeRecoveries >= MAX_ACTIVE_RECOVERIES) {
      return res.status(503).json({
        success: false,
        message: 'Service temporarily unavailable. Please try again later.'
      });
    }

    activeRecoveries++;

    const response = res.status(202).json(recoveryResponse);

    setImmediate(() => {
      void processRecovery(input);
    });

    return response;
  };
}
