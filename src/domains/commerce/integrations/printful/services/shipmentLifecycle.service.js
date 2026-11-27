import { Shipment } from '../../../../../models/Shipment.js';
import { sequelize } from '../../../../../database/database.js';

const VALID_STATUSES = new Set([
  'shipped',
  'delivered',
  'returned'
]);

const STATUS_PRIORITY = {
  pending: 0,
  shipped: 1,
  delivered: 2,
  returned: 3
};

export function normalizeShipmentDate(value) {
  if (value == null || value === '') return null;

  let date;

  if (
    typeof value === 'number' ||
    /^\\d+(\\.\\d+)?$/.test(String(value))
  ) {
    const timestamp = Number(value);

    if (!Number.isFinite(timestamp) || timestamp <= 0) {
      return null;
    }

    date = new Date(
      timestamp < 1e12 ? timestamp * 1000 : timestamp
    );
  } else {
    date = new Date(value);
  }

  return Number.isNaN(date.getTime()) ? null : date;
}

export async function recordShipmentEvent({
  saleId,
  shipment,
  status
}) {
  if (!Number.isSafeInteger(saleId) || saleId <= 0) {
    throw new Error('Invalid sale ID');
  }

  const shipmentId = String(shipment?.id ?? '').trim();

  if (!shipmentId || shipmentId.length > 255) {
    throw new Error('Invalid Printful shipment ID');
  }

  if (!VALID_STATUSES.has(status)) {
    throw new Error('Invalid shipment status');
  }

  return sequelize.transaction(async transaction => {
    const [record, created] = await Shipment.findOrCreate({
      where: {
        saleId,
        printfulShipmentId: shipmentId
      },
      defaults: {
        status: 'pending',
        evidenceSource: 'printful_v2'
      },
      transaction
    });

    await record.reload({
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    if (record.evidenceSource !== 'printful_v2') {
      throw new Error(
        'Shipment requires evidence reconciliation'
      );
    }

    const previousStatus = record.status;

    const previousPriority =
      STATUS_PRIORITY[previousStatus];

    if (previousPriority === undefined) {
      throw new Error('Unsupported existing shipment status');
    }

    const nextStatus =
      STATUS_PRIORITY[status] > previousPriority
        ? status
        : previousStatus;

    const updates = {
      status: nextStatus
    };

    const metadata = {
      carrier: shipment.carrier,
      service: shipment.service,
      trackingNumber: shipment.tracking_number,
      trackingUrl: shipment.tracking_url
    };

    for (const [field, value] of Object.entries(metadata)) {
      if (
        typeof value === 'string' &&
        value.trim() &&
        value.length <= 255 &&
        !record[field]
      ) {
        updates[field] = value.trim();
      }
    }

    const shippedAt =
      normalizeShipmentDate(shipment.shipped_at) ||
      normalizeShipmentDate(shipment.ship_date);

    const deliveredAt =
      normalizeShipmentDate(shipment.delivered_at);

    const returnedAt =
      normalizeShipmentDate(shipment.returned_at);

    if (shippedAt && !record.shippedAt) {
      updates.shippedAt = shippedAt;
    }

    if (
      status === 'delivered' &&
      deliveredAt &&
      !record.deliveredAt
    ) {
      updates.deliveredAt = deliveredAt;
    }

    if (
      status === 'returned' &&
      returnedAt &&
      !record.returnedAt
    ) {
      updates.returnedAt = returnedAt;
    }

    await record.update(updates, { transaction });

    return {
      shipment: record.get({ plain: true }),
      created,
      previousStatus,
      statusChanged: previousStatus !== nextStatus
    };
  });
}
