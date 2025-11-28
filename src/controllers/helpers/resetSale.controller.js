import { Sale } from '../../models/Sale.js';

/**
 * Endpoint temporal para resetear Sale de prueba
 */
export const resetTestSale = async (req, res) => {
  try {
    const { saleId } = req.body;

    const sale = await Sale.findByPk(saleId);
    
    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Sale no encontrado'
      });
    }

    // Resetear campos de Printful para poder sincronizar de nuevo
    await sale.update({
      printfulOrderId: null,
      printfulStatus: null,
      printfulUpdatedAt: null,
      syncStatus: 'pending',
      trackingNumber: null,
      trackingUrl: null,
      carrier: null,
      shippedAt: null,
      errorMessage: null,
      completedAt: null
    });

    return res.status(200).json({
      success: true,
      message: 'Sale reseteado para pruebas',
      saleId: sale.id
    });

  } catch (error) {
    console.error('❌ Error reseteando Sale:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al resetear Sale',
      error: error.message
    });
  }
};
