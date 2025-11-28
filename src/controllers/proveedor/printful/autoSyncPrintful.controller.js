import { autoSyncOrderToPrintful } from '../../../services/autoSyncPrintful.service.js';

/**
 * =====================================================================================
 * CONTROLLER: Auto-Sync Order to Printful
 * 
 * Endpoint: POST /api/printful/sync-order
 * 
 * Body:
 * {
 *   "saleId": 123
 * }
 * 
 * Este endpoint permite sincronizar manualmente una venta con Printful.
 * 
 * Validaciones:
 * - La venta debe existir
 * - Debe tener un Receipt con status='pagado'
 * - Debe tener dirección de envío válida
 * - Debe tener productos con variant_id válido
 * - No debe estar ya sincronizada
 * 
 * Respuestas:
 * - 200: Sincronización exitosa
 * - 400: Validación fallida (no pagado, sin dirección, etc.)
 * - 409: Venta ya sincronizada
 * - 500: Error interno o de Printful
 * =====================================================================================
 */

export const syncOrderToPrintful = async (req, res) => {
  try {
    const { saleId } = req.body;

    // Validar que se envió saleId
    if (!saleId) {
      return res.status(400).json({
        success: false,
        message: 'Sale ID es requerido'
      });
    }

    console.log(`\n📥 [CONTROLLER] Solicitud de sincronización recibida para Sale ID: ${saleId}`);

    // Llamar al servicio de auto-sync
    const result = await autoSyncOrderToPrintful(saleId);

    // Manejar resultado según el tipo de error
    if (!result.success) {
      switch (result.errorType) {
        case 'NO_RECEIPT':
          return res.status(400).json({
            success: false,
            message: result.message,
            errorType: result.errorType,
            saleId: result.saleId
          });

        case 'PAYMENT_NOT_CONFIRMED':
          return res.status(400).json({
            success: false,
            message: result.message,
            errorType: result.errorType,
            saleId: result.saleId,
            receiptStatus: result.receiptStatus
          });

        case 'SALE_NOT_FOUND':
          return res.status(404).json({
            success: false,
            message: result.message,
            errorType: result.errorType,
            saleId: result.saleId
          });

        case 'ALREADY_SYNCED':
          return res.status(409).json({
            success: false,
            message: result.message,
            errorType: result.errorType,
            saleId: result.saleId,
            printfulOrderId: result.printfulOrderId,
            printfulStatus: result.printfulStatus
          });

        case 'NO_ADDRESS':
          return res.status(400).json({
            success: false,
            message: result.message,
            errorType: result.errorType,
            saleId: result.saleId
          });

        case 'NO_PRODUCTS':
          return res.status(400).json({
            success: false,
            message: result.message,
            errorType: result.errorType,
            saleId: result.saleId
          });

        case 'INVALID_PRODUCTS':
          return res.status(400).json({
            success: false,
            message: result.message,
            errorType: result.errorType,
            saleId: result.saleId,
            detailId: result.detailId
          });

        case 'PRINTFUL_ERROR':
          return res.status(500).json({
            success: false,
            message: result.message,
            errorType: result.errorType,
            saleId: result.saleId,
            printfulError: result.printfulError
          });

        default:
          return res.status(500).json({
            success: false,
            message: result.message,
            errorType: result.errorType,
            saleId: result.saleId,
            error: result.error
          });
      }
    }

    // Sincronización exitosa
    return res.status(200).json({
      success: true,
      message: result.message,
      data: {
        saleId: result.saleId,
        printfulOrderId: result.printfulOrderId,
        printfulStatus: result.printfulStatus,
        shippingService: result.shippingService,
        shippingCost: result.shippingCost,
        deliveryDates: result.deliveryDates,
        dashboardUrl: result.dashboardUrl
      }
    });

  } catch (error) {
    console.error('❌ [CONTROLLER] Error en syncOrderToPrintful:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno al sincronizar orden',
      error: error.message
    });
  }
};
