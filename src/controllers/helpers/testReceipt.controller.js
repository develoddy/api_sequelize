import { Receipt } from '../../models/Receipt.js';

/**
 * Endpoint temporal para crear Receipt de prueba
 */
export const createTestReceipt = async (req, res) => {
  try {
    const { saleId, amount, paymentMethod, status, zipcode } = req.body;

    const receipt = await Receipt.create({
      saleId: saleId || 99,
      amount: amount || 45.95,
      paymentMethod: paymentMethod || 'stripe',
      status: status || 'pendiente',
      zipcode: zipcode || '28001'
    });

    return res.status(201).json({
      success: true,
      message: 'Receipt de prueba creado',
      data: receipt
    });
  } catch (error) {
    console.error('Error creando Receipt:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al crear Receipt',
      error: error.message
    });
  }
};

/**
 * Endpoint temporal para actualizar status de Receipt
 */
export const updateReceiptStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const receipt = await Receipt.findByPk(id);
    
    if (!receipt) {
      return res.status(404).json({
        success: false,
        message: 'Receipt no encontrado'
      });
    }

    await receipt.update({ status });

    return res.status(200).json({
      success: true,
      message: 'Receipt actualizado',
      data: receipt
    });
  } catch (error) {
    console.error('Error actualizando Receipt:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al actualizar Receipt',
      error: error.message
    });
  }
};
