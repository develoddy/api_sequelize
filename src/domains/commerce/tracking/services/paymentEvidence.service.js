import {
  isPrintfulV2ScopedSale
} from '../../integrations/printful/services/printfulV2Scope.service.js';

import { QueryTypes } from 'sequelize';
import { sequelize } from '../../../../database/database.js';

export async function hasVerifiedPayment(sale) {
  if (
    !isPrintfulV2ScopedSale(sale) ||
    sale.method_payment !== 'STRIPE' ||
    typeof sale.stripeSessionId !== 'string' ||
    !sale.stripeSessionId
  ) {
    return false;
  }

  const amount = Math.round(Number(sale.total) * 100);
  const currency = String(sale.currency_payment || '').toLowerCase();

  if (
    !Number.isSafeInteger(amount) ||
    amount <= 0 ||
    !/^[a-z]{3}$/.test(currency)
  ) {
    return false;
  }

  try {
    const rows = await sequelize.query(`
      SELECT id
      FROM stripe_webhook_logs
      WHERE event_type = 'checkout.session.completed'
        AND status = 'success'
        AND tenant_id <=> :tenantId
        AND CASE
          WHEN JSON_VALID(payload) THEN
            JSON_UNQUOTE(JSON_EXTRACT(
              payload, '$.data.object.id'
            )) = :sessionId
            AND JSON_UNQUOTE(JSON_EXTRACT(
              payload, '$.data.object.payment_status'
            )) = 'paid'
            AND JSON_UNQUOTE(JSON_EXTRACT(
              payload, '$.data.object.mode'
            )) = 'payment'
            AND JSON_UNQUOTE(JSON_EXTRACT(
              payload, '$.data.object.amount_total'
            )) = :amount
            AND JSON_UNQUOTE(JSON_EXTRACT(
              payload, '$.data.object.currency'
            )) = :currency
          ELSE FALSE
        END
      LIMIT 1
    `, {
      replacements: {
        tenantId: sale.tenant_id,
        sessionId: sale.stripeSessionId,
        amount: String(amount),
        currency
      },
      type: QueryTypes.SELECT
    });

    return rows.length === 1;

  } catch (error) {
    console.warn('[Tracking] Payment evidence unavailable', {
      saleId: sale.id,
      errorType: error.name
    });

    return false;
  }
}
