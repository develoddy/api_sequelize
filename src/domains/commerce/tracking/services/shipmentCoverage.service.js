import {
  normalizeLifecycleDate
} from './orderLifecycle.service.js';

function normalizeId(value) {
  if (
    typeof value !== 'string' &&
    !Number.isSafeInteger(value)
  ) {
    return null;
  }

  const id = String(value);

  return /^[1-9][0-9]{0,19}$/.test(id) ? id : null;
}

function validQuantity(value) {
  return Number.isSafeInteger(value) && value > 0;
}

export function resolveShipmentCoverage({
  providerStatus,
  orderItems,
  providerShipments,
  verifiedShipments,
  inventoryComplete = false
} = {}) {
  const reject = reason => ({
    coverageVerified: false,
    deliveryVerified: false,
    reason
  });

  if (providerStatus !== 'fulfilled') {
    return reject('order_not_fully_shipped');
  }

  if (inventoryComplete !== true) {
    return reject('incomplete_provider_inventory');
  }

  if (
    !Array.isArray(orderItems) ||
    !orderItems.length ||
    !Array.isArray(providerShipments) ||
    !providerShipments.length ||
    !Array.isArray(verifiedShipments)
  ) {
    return reject('missing_logistics_evidence');
  }

  const expected = new Map();
  const covered = new Map();
  const evidence = new Map();
  const shipmentIds = new Set();

  for (const item of orderItems) {
    const id = normalizeId(item?.id);

    if (
      !id ||
      !validQuantity(item?.quantity) ||
      expected.has(id)
    ) {
      return reject('invalid_order_items');
    }

    expected.set(id, item.quantity);
    covered.set(id, 0);
  }

  for (const shipment of verifiedShipments) {
    const id = normalizeId(shipment?.printfulShipmentId);

    if (!id || evidence.has(id)) {
      return reject('invalid_local_shipment_identity');
    }

    if (!['printful_v2', 'printful_v2_api'].includes(shipment.evidenceSource)) {
      return reject('unverified_evidence_source');
    }

    if (shipment.status === 'returned') {
      return reject('unresolved_return');
    }

    evidence.set(id, shipment);
  }

  for (const shipment of providerShipments) {
    const id = normalizeId(shipment?.id);

    if (!id || shipmentIds.has(id)) {
      return reject('invalid_provider_shipment_identity');
    }

    shipmentIds.add(id);

    if (
      !Array.isArray(shipment.shipment_items) ||
      !shipment.shipment_items.length
    ) {
      return reject('missing_shipment_items');
    }

    for (const item of shipment.shipment_items) {
      const itemId = normalizeId(item?.order_item_id);

      if (
        !itemId ||
        !expected.has(itemId) ||
        !validQuantity(item?.quantity)
      ) {
        return reject('invalid_shipment_items');
      }

      covered.set(
        itemId,
        covered.get(itemId) + item.quantity
      );
    }
  }

  for (const [id, quantity] of expected) {
    if (covered.get(id) !== quantity) {
      return reject('item_quantity_mismatch');
    }
  }

  if (shipmentIds.size !== evidence.size) {
    return reject('shipment_inventory_mismatch');
  }

  for (const id of shipmentIds) {
    const shipment = evidence.get(id);

    if (
      !shipment ||
      !['shipped', 'delivered'].includes(shipment.status)
    ) {
      return reject('missing_shipment_evidence');
    }
  }

  const deliveryVerified = [...evidence.values()].every(
    shipment =>
      shipment.status === 'delivered' &&
      Boolean(normalizeLifecycleDate(shipment.deliveredAt))
  );

  return {
    coverageVerified: true,
    deliveryVerified,
    reason: deliveryVerified
      ? null
      : 'delivery_pending'
  };
}
