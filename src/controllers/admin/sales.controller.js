import axios from 'axios';
import { Sale } from '../../models/Sale.js';

const PRINTFUL_API_KEY = 'CcbTqhupaIzBCtmkhmnYY59az1Tc8WxIrF9auaGH';

export const refreshPrintfulStatus = async (req, res) => {
  const { id } = req.params;
  console.log('[Admin] Refrescando estado de Printful para venta:', id);

  const sale = await Sale.findByPk(id);
  if (!sale) return res.status(404).json({ success: false, message: 'Venta no encontrada' });
  if (!sale.printfulOrderId) return res.status(400).json({ success: false, message: 'Venta sin PrintfulOrderId' });

  try {
    const response = await axios.get(`https://api.printful.com/orders/${sale.printfulOrderId}`, {
      headers: { Authorization: `Bearer ${PRINTFUL_API_KEY}` } //headers: { Authorization: `Bearer ${process.env.PRINTFUL_API_KEY}` }
    });

    const pfOrder = response.data.result;
    console.log('[Printful] Estado actualizado:', pfOrder.status);

    await sale.update({
      printfulStatus: pfOrder.status,
      printfulUpdatedAt: new Date()
    });

    res.json({ success: true, printfulStatus: pfOrder.status });
  } catch (error) {
    console.error('[Printful] Error al obtener estado:', error.response?.data || error.message);
    res.status(500).json({ success: false, message: 'Error al obtener estado de Printful' });
  }
};
