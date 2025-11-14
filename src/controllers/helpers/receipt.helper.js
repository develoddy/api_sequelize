import { Receipt } from '../../models/Receipt.js';

  //export const createSaleReceipt = async (sale, paymentMethod, metadata = {}) => {
  export const createSaleReceipt = async (sale, paymentMethod, metadata = {}, saleAddress = null) => {
  try {
    const notes =
        paymentMethod === 'STRIPE'
            ? `Pago con Stripe – sesión: ${metadata.sessionId || 'N/A'} – venta #${sale.id}`
            : `Pago con PayPal – venta #${sale.id}`;


    const receipt = await Receipt.create({
      saleId: sale.id,
      userId: sale.userId || null,
      guestId: sale.guestId || null,
      amount: sale.total,
      paymentMethod,
      paymentDate: new Date(),
      status: paymentMethod === 'STRIPE' ? 'paid' : 'pagado',
      notes,
      zipcode: saleAddress?.zipcode || sale.zipcode || '', // <- aquí agregamos zipcode
    });

    console.log(`[Receipt Helper] Recibo creado: ID ${receipt.id} para venta ${sale.id}`);
    return receipt;
  } catch (err) {
    console.error(`[Receipt Helper] Error creando Receipt para venta ${sale.id}:`, err.message || err);
    throw err;
  }
};
