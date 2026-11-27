import { SaleAddress } from '../../../../models/SaleAddress.js';
import { SaleDetail } from '../../../../models/SaleDetail.js';
import { Product } from '../../../../models/Product.js';
import { Variedad } from '../../../../models/Variedad.js';

export async function buildOrderNotificationData({
  sale,
  lifecycle,
  verifiedShipments
}) {
  if (
    !sale ||
    sale.tenant_id != null ||
    !sale.printfulOrderId ||
    !sale.trackingToken ||
    !lifecycle ||
    !Array.isArray(verifiedShipments) ||
    verifiedShipments.length === 0
  ) {
    throw new Error('Invalid order notification data');
  }

  const [addresses, details] = await Promise.all([
    SaleAddress.findAll({
      where: { saleId: sale.id },
      limit: 2
    }),
    SaleDetail.findAll({
      where: { saleId: sale.id },
      include: [
        {
          model: Product,
          attributes: ['id', 'title', 'portada']
        },
        {
          model: Variedad,
          attributes: ['id', 'valor', 'color']
        }
      ]
    })
  ]);

  if (addresses.length !== 1) {
    throw new Error('Unresolved sale address');
  }

  const address = addresses[0];

  const email = String(address.email || '').trim();

  if (!/^[^\\s@,;]+@[^\\s@,;]+\\.[^\\s@,;]+$/.test(email)) {
    throw new Error('Invalid order recipient');
  }

  const customerName = [
    address.name,
    address.surname
  ].filter(Boolean).join(' ').trim() || 'Cliente';

  const products = details.map(detail => ({
    image: detail.product?.portada && process.env.URL_BACKEND
      ? `${process.env.URL_BACKEND}/api/products/uploads/product/${detail.product.portada}`
      : null,
    title: detail.product?.title ||
      detail.code_discount ||
      'Producto',
    quantity: detail.cantidad,
    variant: detail.variedad?.valor || null
  }));

  const singleShipment = verifiedShipments.length === 1
    ? verifiedShipments[0]
    : null;

  return {
    customer: {
      name: customerName,
      email
    },
    order: {
      id: sale.id,
      trackingToken: sale.trackingToken,
      printfulOrderId: sale.printfulOrderId,
      n_transaction: sale.n_transaction,
      created: sale.createdAt,
      total: sale.total,
      currency: sale.currency_payment || 'EUR'
    },
    shipment: {
      trackingNumber: singleShipment?.trackingNumber || null,
      trackingUrl: singleShipment?.trackingUrl || null,
      carrier: singleShipment?.carrier || null,
      service: singleShipment?.service || null,
      estimatedDeliveryDate: sale.maxDeliveryDate || null,
      shippedDate: lifecycle.shippedAt
    },
    delivery: {
      deliveredDate: lifecycle.deliveredAt,
      address: [
        address.address,
        address.ciudad,
        address.region
      ].filter(Boolean).join(', ')
    },
    products,
    address: {
      name: customerName,
      address: address.address || '',
      ciudad: address.ciudad || '',
      region: address.region || '',
      telefono: address.telefono || ''
    },
    tenant: null
  };
}
