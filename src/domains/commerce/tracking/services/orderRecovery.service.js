import { Sale } from '../../../../models/Sale.js';
import { SaleAddress } from '../../../../models/SaleAddress.js';
import { Guest } from '../../../../models/Guest.js';
import { hasVerifiedPayment } from './paymentEvidence.service.js';
import {
  resolvePrintfulV2Scope
} from '../../integrations/printful/services/printfulV2Scope.service.js';

function normalizeOrderId(value) {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return null;
  }

  const normalized = String(value).trim().replace(/^#/, '');

  if (!/^[1-9][0-9]{0,9}$/.test(normalized)) {
    return null;
  }

  const id = Number(normalized);

  return Number.isSafeInteger(id) && id <= 2147483647
    ? id
    : null;
}

function normalizeEmail(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const email = value.trim().toLowerCase();

  if (
    email.length > 254 ||
    !/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(email)
  ) {
    return null;
  }

  return email;
}

export async function resolveGuestOrderRecovery({
  orderId,
  email
} = {}) {
  const id = normalizeOrderId(orderId);
  const requestedEmail = normalizeEmail(email);
  const scope = resolvePrintfulV2Scope();

  if (!id || !requestedEmail || !scope) {
    return null;
  }

  const sale = await Sale.findOne({
    where: {
      id,
      ...scope,
      userId: null
    },
    attributes: [
      'id',
      'guestId',
      'tenant_id',
      'module_id',
      'method_payment',
      'stripeSessionId',
      'total',
      'currency_payment',
      'trackingToken',
      'country',
      'locale'
    ],
    raw: true
  });

  if (
    !sale ||
    !sale.guestId ||
    !/^[a-f0-9]{32}$/i.test(sale.trackingToken || '')
  ) {
    return null;
  }

  const addresses = await SaleAddress.findAll({
    where: { saleId: sale.id },
    attributes: ['email'],
    limit: 2,
    raw: true
  });

  if (addresses.length !== 1) {
    return null;
  }

  const storedEmail = normalizeEmail(addresses[0].email);

  if (!storedEmail || storedEmail !== requestedEmail) {
    return null;
  }

  const guest = await Guest.findByPk(sale.guestId, {
    attributes: ['email'],
    raw: true
  });

  const buyerEmail = normalizeEmail(guest?.email);

  if (!buyerEmail || buyerEmail !== storedEmail) {
    return null;
  }

  if (!(await hasVerifiedPayment(sale))) {
    return null;
  }

  const country = String(sale.country || 'es').toLowerCase();
  const locale = String(sale.locale || 'es').toLowerCase();

  if (
    !/^[a-z]{2}$/.test(country) ||
    !/^[a-z]{2}$/.test(locale)
  ) {
    return null;
  }

  let base;

  try {
    base = new URL(process.env.URL_FRONTEND || '');
  } catch {
    return null;
  }

  if (
    !['http:', 'https:'].includes(base.protocol) ||
    base.username ||
    base.password ||
    base.search ||
    base.hash ||
    (
      process.env.NODE_ENV === 'production' &&
      base.protocol !== 'https:'
    )
  ) {
    return null;
  }

  const trackingUrl = [
    base.href.replace(/[/]+$/, ''),
    country,
    locale,
    'tracking',
    encodeURIComponent(String(sale.id)),
    encodeURIComponent(sale.trackingToken)
  ].join('/');

  return {
    orderId: sale.id,
    recipient: addresses[0].email.trim(),
    language: locale === 'es' ? 'es' : 'en',
    trackingUrl
  };
}
