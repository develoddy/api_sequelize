import axios from 'axios';
import { Sale } from '../../models/Sale.js';

const PRINTFUL_API_TOKEN = process.env.PRINTFUL_API_TOKEN; 

export const refreshPrintfulStatus = async (req, res) => {
  const { id } = req.params;

  const sale = await Sale.findByPk(id);
  if (!sale) return res.status(404).json({ success: false, message: 'Venta no encontrada' });
  if (!sale.printfulOrderId) return res.status(400).json({ success: false, message: 'Venta sin PrintfulOrderId' });

  try {
    const response = await axios.get(`https://api.printful.com/orders/${sale.printfulOrderId}`, {
      headers: { Authorization: `Bearer ${PRINTFUL_API_TOKEN}` } 
    });

    const pfOrder = response.data.result;
    console.log('[Printful] Estado actualizado:', pfOrder.status);

    // Extract estimated delivery dates from common locations in Printful response
    let minDeliveryDate = null;
    let maxDeliveryDate = null;

    try {
      // Try retail_costs.delivery_estimates
      if (pfOrder.retail_costs && pfOrder.retail_costs.delivery_estimates) {
        minDeliveryDate = pfOrder.retail_costs.delivery_estimates.min || null;
        maxDeliveryDate = pfOrder.retail_costs.delivery_estimates.max || null;
      }

      // Fallback: shipments[0].estimated_delivery_dates
      if ((!minDeliveryDate || !maxDeliveryDate) && Array.isArray(pfOrder.shipments) && pfOrder.shipments.length > 0) {
        const est = pfOrder.shipments[0].estimated_delivery_dates;
        if (est) {
          minDeliveryDate = minDeliveryDate || est.min || null;
          maxDeliveryDate = maxDeliveryDate || est.max || null;
        }
      }
    } catch (e) {
      console.warn('[Printful] Error extracting delivery estimates:', e && (e.message || e));
    }

    // Normalize dates to YYYY-MM-DD or null
    const normalizeDate = (v) => {
      if (!v) return null;
      try {
        const d = new Date(v);
        if (isNaN(d.getTime())) return null;
        return d.toISOString().split('T')[0];
      } catch (e) { return null; }
    };

    const minDateNormalized = normalizeDate(minDeliveryDate);
    const maxDateNormalized = normalizeDate(maxDeliveryDate);

    console.log('[Printful] Fechas estimadas:', minDateNormalized, maxDateNormalized);

    await sale.update({
      printfulStatus: pfOrder.status,
      minDeliveryDate: minDateNormalized,
      maxDeliveryDate: maxDateNormalized,
      printfulUpdatedAt: new Date()
    });

    res.json({ success: true, printfulStatus: pfOrder.status, minDeliveryDate: minDateNormalized, maxDeliveryDate: maxDateNormalized });
  } catch (error) {
    console.error('[Printful] Error al obtener estado:', error.response?.data || error.message);
    res.status(500).json({ success: false, message: 'Error al obtener estado de Printful' });
  }
};
