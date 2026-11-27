import {
  resolveShipmentCoverage
} from '../../tracking/services/shipmentCoverage.service.js';

import {
  resolveOrderLifecycle
} from '../../tracking/services/orderLifecycle.service.js';

export function resolveNotificationEligibility({
  logistics,
  verifiedShipments
} = {}) {
  const coverage = resolveShipmentCoverage({
    ...logistics,
    verifiedShipments
  });

  const lifecycle = resolveOrderLifecycle({
    providerStatus: logistics?.providerStatus || null,
    verifiedShipments,
    shipmentCoverageVerified: coverage.coverageVerified
  });

  const eligibleEvents = [];

  if (
    !coverage.coverageVerified ||
    lifecycle.exceptions.length > 0
  ) {
    return {
      eligibleEvents,
      lifecycle,
      coverage
    };
  }

  // Do not send a late shipping email for an already delivered order.
  if (lifecycle.fullyDelivered) {
    eligibleEvents.push('order_delivered');
  } else if (
    lifecycle.fullyShipped &&
    lifecycle.shippedAt
  ) {
    eligibleEvents.push('order_shipped');
  }

  return {
    eligibleEvents,
    lifecycle,
    coverage
  };
}
