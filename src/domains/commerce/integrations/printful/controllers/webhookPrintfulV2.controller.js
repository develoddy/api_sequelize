import {
  resolvePrintfulV2Scope
} from '../services/printfulV2Scope.service.js';

import { Sale } from '../../../../../models/Sale.js';

import {
  reconcileOrderNotifications
} from '../../../notifications/services/orderNotificationOrchestrator.service.js';

import {
  recordShipmentEvent,
  normalizeShipmentDate
} from '../services/shipmentLifecycle.service.js';

import {
  verifyPrintfulV2Signature
} from '../services/webhookSignatureV2.service.js';

export function validatePrintfulV2Webhook(req, res, next) {
  const expectedPublicKey = process.env.PRINTFUL_V2_PUBLIC_KEY;
  const secretKey = process.env.PRINTFUL_V2_SECRET_KEY;
  const storeId = process.env.PRINTFUL_V2_STORE_ID;

  if (
    !expectedPublicKey ||
    !secretKey ||
    !/^(?:[a-fA-F0-9]{2})+$/.test(secretKey) ||
    !storeId ||
    !/^\d+$/.test(storeId)
  ) {
    return res.status(503).json({
      success: false,
      message: 'Webhook unavailable'
    });
  }

  const valid = verifyPrintfulV2Signature({
    rawBody: req.rawBody,
    signature: req.get('x-pf-webhook-signature'),
    publicKey: req.get('x-pf-webhook-public-key'),
    expectedPublicKey,
    secretKey
  });

  if (!valid) {
    return res.status(401).json({
      success: false,
      message: 'Invalid webhook signature'
    });
  }

  const event = req.body;

  if (
    !event ||
    typeof event.type !== 'string' ||
    !Number.isSafeInteger(event.store_id) ||
    !event.data ||
    typeof event.data !== 'object' ||
    Array.isArray(event.data)
  ) {
    return res.status(400).json({
      success: false,
      message: 'Invalid webhook event'
    });
  }

  if (String(event.store_id) !== storeId) {
    return res.status(403).json({
      success: false,
      message: 'Unauthorized store'
    });
  }

  return next();
}

const SHIPMENT_EVENTS = new Map([
  ['shipment_sent', 'shipped'],
  ['shipment_delivered', 'delivered'],
  ['shipment_returned', 'returned']
]);

export async function handleWebhookV2(req, res) {
  const event = req.body;
  const status = SHIPMENT_EVENTS.get(event.type);

  if (!status) {
    return res.status(422).json({
      success: false,
      message: 'Unsupported event type'
    });
  }

  const orderId = event.data?.order?.id;
  const shipment = event.data?.shipment;
  const shipmentId = shipment?.id;
  const eventDate = normalizeShipmentDate(event.occurred_at);

  const validId = value =>
    (typeof value === 'string' ||
     Number.isSafeInteger(value)) &&
    /^[1-9][0-9]{0,19}$/.test(String(value));

  if (
    !validId(orderId) ||
    !validId(shipmentId) ||
    !eventDate
  ) {
    return res.status(400).json({
      success: false,
      message: 'Invalid shipment event'
    });
  }

  try {
    const scope = resolvePrintfulV2Scope();

    if (!scope) {
      return res.status(503).json({
        success: false,
        message: 'Shipment scope unavailable'
      });
    }

    const sales = await Sale.findAll({
      where: {
        printfulOrderId: String(orderId),
        ...scope
      },
      attributes: ['id'],
      limit: 2
    });

    if (sales.length !== 1) {
      console.warn(
        '[Printful V2] Unresolved sale association',
        String(orderId)
      );

      return res.status(503).json({
        success: false,
        message: 'Sale association unavailable'
      });
    }

    const normalizedShipment = {
      ...shipment
    };

    if (status === 'shipped') {
      normalizedShipment.shipped_at =
        normalizeShipmentDate(shipment.shipped_at) ||
        normalizeShipmentDate(shipment.ship_date) ||
        eventDate;
    }

    if (status === 'delivered') {
      normalizedShipment.delivered_at =
        normalizeShipmentDate(shipment.delivered_at) ||
        eventDate;
    }

    if (status === 'returned') {
      normalizedShipment.returned_at =
        normalizeShipmentDate(shipment.returned_at) ||
        eventDate;
    }

    const result = await recordShipmentEvent({
      saleId: sales[0].id,
      shipment: normalizedShipment,
      status
    });

    console.info('[Printful V2] Shipment processed', {
      saleId: sales[0].id,
      shipmentId: String(shipmentId),
      eventType: event.type,
      created: result.created,
      statusChanged: result.statusChanged
    });

    if (
      process.env.PRINTFUL_V2_NOTIFICATIONS_ENABLED === 'true'
    ) {
      await reconcileOrderNotifications(sales[0].id);
    }

    return res.status(200).json({
      success: true
    });

  } catch (error) {
    console.error(
      '[Printful V2] Shipment processing failed',
      error.name
    );

    return res.status(503).json({
      success: false,
      message: 'Shipment processing unavailable'
    });
  }
}
