import { Sale } from '../../../../models/Sale.js';
import { Shipment } from '../../../../models/Shipment.js';

import {
  usesV2OrderNotifications
} from './orderNotificationPolicy.service.js';

import {
  fetchPrintfulLogistics
} from '../../integrations/printful/services/printfulLogistics.service.js';

import {
  resolveNotificationEligibility
} from './orderNotificationEligibility.service.js';

import {
  buildOrderNotificationData
} from './orderNotificationData.service.js';

import {
  dispatchOrderNotification
} from './orderNotificationDispatch.service.js';

import {
  sendOrderShippedEmail,
  sendOrderDeliveredEmail
} from './emailNotification.service.js';

export async function reconcileOrderNotifications(saleId) {
  if (
    process.env.PRINTFUL_V2_NOTIFICATIONS_ENABLED !== 'true'
  ) {
    return { status: 'disabled' };
  }

  if (!Number.isSafeInteger(saleId) || saleId <= 0) {
    throw new Error('Invalid sale identifier');
  }

  const sale = await Sale.findByPk(saleId);

  if (
    !usesV2OrderNotifications(sale) ||
    !sale.printfulOrderId
  ) {
    return { status: 'ineligible_sale' };
  }

  const logistics = await fetchPrintfulLogistics({
    orderId: sale.printfulOrderId,
    storeId: process.env.PRINTFUL_V2_STORE_ID,
    apiToken: process.env.PRINTFUL_API_TOKEN
  });

  const verifiedShipments = await Shipment.findAll({
    where: {
      saleId: sale.id,
      evidenceSource: 'printful_v2'
    },
    raw: true
  });

  const eligibility = resolveNotificationEligibility({
    logistics,
    verifiedShipments
  });

  if (eligibility.eligibleEvents.length === 0) {
    return { status: 'not_eligible' };
  }

  const emailData = await buildOrderNotificationData({
    sale,
    lifecycle: eligibility.lifecycle,
    verifiedShipments
  });

  const results = [];

  for (const eventType of eligibility.eligibleEvents) {
    const sender = eventType === 'order_delivered'
      ? sendOrderDeliveredEmail
      : sendOrderShippedEmail;

    const result = await dispatchOrderNotification({
      saleId: sale.id,
      eventType,
      send: () => sender(emailData)
    });

    results.push({
      eventType,
      ...result
    });
  }

  return {
    status: 'processed',
    results
  };
}
