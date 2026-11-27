import {
  hasVerifiedPayment
} from '../../tracking/services/paymentEvidence.service.js';

import {
  isPrintfulV2ScopedSale
} from '../../integrations/printful/services/printfulV2Scope.service.js';

export function usesV2OrderNotifications(sale) {
  if (
    process.env.PRINTFUL_V2_NOTIFICATIONS_ENABLED !== 'true' ||
    !isPrintfulV2ScopedSale(sale) ||
    sale.method_payment !== 'STRIPE' ||
    !sale.stripeSessionId
  ) {
    return false;
  }

  const configuredCutover =
    process.env.PRINTFUL_V2_NOTIFICATIONS_CUTOVER_AT;

  if (
    !configuredCutover ||
    !configuredCutover.endsWith('Z') ||
    !sale.createdAt
  ) {
    return false;
  }

  const cutover = Date.parse(configuredCutover);
  const createdAt = new Date(sale.createdAt).getTime();

  return (
    Number.isFinite(cutover) &&
    Number.isFinite(createdAt) &&
    createdAt >= cutover
  );
}

export async function canDelegateV2OrderNotifications(sale) {
  if (!usesV2OrderNotifications(sale)) {
    return false;
  }

  return await hasVerifiedPayment(sale);
}
