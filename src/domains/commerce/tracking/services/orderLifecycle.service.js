export function normalizeLifecycleDate(value) {
  if (
    value == null ||
    value === '' ||
    (
      typeof value !== 'string' &&
      typeof value !== 'number' &&
      !(value instanceof Date)
    )
  ) {
    return null;
  }

  const numeric =
    typeof value === 'number' ||
    /^[0-9]+([.][0-9]+)?$/.test(String(value));

  const timestamp = numeric ? Number(value) : null;

  if (
    numeric &&
    (!Number.isFinite(timestamp) || timestamp <= 0)
  ) {
    return null;
  }

  const date = numeric
    ? new Date(timestamp < 1e12 ? timestamp * 1000 : timestamp)
    : new Date(value);

  return Number.isNaN(date.getTime())
    ? null
    : date.toISOString();
}

export function resolveOrderLifecycle({
  providerStatus = null,
  localStatus = null,
  commerciallyConfirmed = false,
  verifiedShipments = [],
  shipmentCoverageVerified = false
} = {}) {
  const status = providerStatus || localStatus || 'unknown';

  const shipments = Array.isArray(verifiedShipments)
    ? verifiedShipments
    : [];

  const hasReturns = shipments.some(
    shipment => shipment.status === 'returned'
  );

  const hasShipped = shipments.some(
    shipment => ['shipped', 'delivered', 'returned'].includes(shipment.status)
  );

  const fullyShipped = providerStatus === 'fulfilled';

  const partiallyShipped =
    !fullyShipped &&
    (providerStatus === 'partial' || hasShipped);

  const productionStarted =
    fullyShipped ||
    partiallyShipped ||
    providerStatus === 'inprocess';

  const confirmed =
    commerciallyConfirmed || productionStarted;

  const shippedDates = shipments.map(
    shipment => normalizeLifecycleDate(shipment.shippedAt)
  );

  const deliveredDates = shipments.map(
    shipment => normalizeLifecycleDate(shipment.deliveredAt)
  );

  const fullyDelivered =
    fullyShipped &&
    shipmentCoverageVerified &&
    shipments.length > 0 &&
    !hasReturns &&
    shipments.every(
      (shipment, index) =>
        shipment.status === 'delivered' &&
        Boolean(deliveredDates[index])
    );

  const shippedAt =
    fullyShipped &&
    shipmentCoverageVerified &&
    shipments.length > 0 &&
    shippedDates.every(Boolean)
      ? [...shippedDates].sort().at(-1)
      : null;

  const deliveredAt = fullyDelivered
    ? [...deliveredDates].sort().at(-1)
    : null;

  let commercialStatus = 'pending_confirmation';
  let progress = 0;

  if (confirmed) {
    commercialStatus = 'confirmed';
    progress = 25;
  }

  if (productionStarted) {
    commercialStatus = 'in_production';
    progress = 50;
  }

  if (partiallyShipped) {
    commercialStatus = 'partially_shipped';
  }

  if (fullyShipped) {
    commercialStatus = 'shipped';
    progress = 75;
  }

  if (fullyDelivered) {
    commercialStatus = 'delivered';
    progress = 100;
  }

  const exceptions = [];

  if (hasReturns) exceptions.push('returned');

  if (status === 'failed') exceptions.push('failed');
  if (status === 'canceled') exceptions.push('canceled');
  if (status === 'onhold') exceptions.push('onhold');

  return {
    commercialStatus,
    progress,
    confirmed,
    productionStarted,
    partiallyShipped,
    fullyShipped,
    fullyDelivered,
    shippedAt,
    deliveredAt,
    exceptions
  };
}
