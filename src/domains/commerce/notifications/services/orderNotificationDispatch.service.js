import { OrderNotificationLog } from '../../../../models/OrderNotificationLog.js';
import { sequelize } from '../../../../database/database.js';

const VALID_EVENTS = new Set([
  'order_shipped',
  'order_delivered'
]);

export async function dispatchOrderNotification({
  saleId,
  eventType,
  send
}) {
  if (
    !Number.isSafeInteger(saleId) ||
    saleId <= 0 ||
    !VALID_EVENTS.has(eventType) ||
    typeof send !== 'function'
  ) {
    throw new Error('Invalid notification parameters');
  }

  const [record] = await OrderNotificationLog.findOrCreate({
    where: { saleId, eventType },
    defaults: {
      status: 'pending',
      attempts: 0
    }
  });

  // Atomic claim: only one caller can acquire the send.
  const [claimed] = await OrderNotificationLog.update({
    status: 'sending',
    attempts: sequelize.literal('attempts + 1')
  }, {
    where: {
      id: record.id,
      status: 'pending'
    }
  });

  if (claimed !== 1) {
    await record.reload();

    return {
      sent: false,
      skipped: true,
      status: record.status
    };
  }

  try {
    const result = await send();

    if (result?.success !== true) {
      await record.update({
        status: 'uncertain'
      });

      return {
        sent: false,
        skipped: false,
        status: 'uncertain'
      };
    }

    await record.update({
      status: 'sent',
      smtpMessageId: result.messageId || null,
      sentAt: new Date()
    });

    return {
      sent: true,
      skipped: false,
      status: 'sent'
    };

  } catch (error) {
    await OrderNotificationLog.update({
      status: 'uncertain'
    }, {
      where: {
        id: record.id,
        status: 'sending'
      }
    });

    console.error('[OrderNotification] Dispatch uncertain', {
      saleId,
      eventType,
      errorType: error.name
    });

    return {
      sent: false,
      skipped: false,
      status: 'uncertain'
    };
  }
}
