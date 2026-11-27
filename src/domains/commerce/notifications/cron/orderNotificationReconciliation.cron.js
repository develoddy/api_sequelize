import {
  resolvePrintfulV2Scope
} from '../../integrations/printful/services/printfulV2Scope.service.js';

import cron from 'node-cron';
import { Op } from 'sequelize';

import { Sale } from '../../../../models/Sale.js';
import { Shipment } from '../../../../models/Shipment.js';
import { OrderNotificationLog } from '../../../../models/OrderNotificationLog.js';

import {
  reconcileOrderNotifications
} from '../services/orderNotificationOrchestrator.service.js';

const BATCH_SIZE = 50;

let running = false;
let cursor = 0;
let task = null;

export async function reconcilePendingOrderNotifications() {
  if (
    running ||
    process.env.PRINTFUL_V2_NOTIFICATIONS_ENABLED !== 'true'
  ) {
    return;
  }

  const configuredCutover =
    process.env.PRINTFUL_V2_NOTIFICATIONS_CUTOVER_AT;

  if (
    !configuredCutover ||
    !configuredCutover.endsWith('Z')
  ) {
    return;
  }

  const cutover = new Date(configuredCutover);

  if (!Number.isFinite(cutover.getTime())) {
    return;
  }

  const scope = resolvePrintfulV2Scope();

  if (!scope) {
    return;
  }

  running = true;

  try {
    const sales = await Sale.findAll({
      where: {
        id: { [Op.gt]: cursor },
        ...scope,
        createdAt: { [Op.gte]: cutover },
        printfulOrderId: { [Op.ne]: null }
      },
      attributes: ['id'],
      order: [['id', 'ASC']],
      limit: BATCH_SIZE,
      raw: true
    });

    for (const sale of sales) {
      cursor = sale.id;

      try {
        const delivered = await OrderNotificationLog.findOne({
          where: {
            saleId: sale.id,
            eventType: 'order_delivered',
            status: {
              [Op.in]: ['sent', 'sending', 'uncertain']
            }
          },
          attributes: ['id'],
          raw: true
        });

        if (delivered) {
          continue;
        }

        const evidence = await Shipment.findOne({
          where: {
            saleId: sale.id,
            evidenceSource: 'printful_v2'
          },
          attributes: ['id'],
          raw: true
        });

        if (!evidence) {
          continue;
        }

        await reconcileOrderNotifications(sale.id);

      } catch (error) {
        console.error('[OrderNotificationCron] Reconciliation failed', {
          saleId: sale.id,
          errorType: error.name
        });
      }
    }

    if (sales.length < BATCH_SIZE) {
      cursor = 0;
    }

  } finally {
    running = false;
  }
}

export function startOrderNotificationReconciliationCron() {
  if (
    task ||
    process.env.PRINTFUL_V2_NOTIFICATIONS_ENABLED !== 'true'
  ) {
    return task;
  }

  task = cron.schedule('*/15 * * * *', async () => {
    try {
      await reconcilePendingOrderNotifications();
    } catch (error) {
      console.error('[OrderNotificationCron] Job failed', {
        errorType: error.name
      });
    }
  }, {
    timezone: 'Europe/Madrid'
  });

  console.log('[OrderNotificationCron] Scheduled every 15 minutes');

  return task;
}
