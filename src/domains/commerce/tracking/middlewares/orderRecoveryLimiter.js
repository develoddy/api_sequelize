import rateLimit from 'express-rate-limit';

export const orderRecoveryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests. Please try again later.'
  }
});

function normalizeRecoveryOrderKey(value) {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return 'invalid';
  }

  const normalized = String(value).trim().replace(/^#/, '');

  if (!/^[1-9][0-9]{0,9}$/.test(normalized)) {
    return 'invalid';
  }

  const id = Number(normalized);

  return Number.isSafeInteger(id) && id <= 2147483647
    ? String(id)
    : 'invalid';
}

export const orderRecoveryOrderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 3,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: req =>
    normalizeRecoveryOrderKey(req.body?.orderId) === 'invalid',
  keyGenerator: req =>
    'order-recovery:' + normalizeRecoveryOrderKey(req.body?.orderId),
  message: {
    success: false,
    message: 'Too many requests. Please try again later.'
  }
});
