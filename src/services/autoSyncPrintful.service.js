import { Sale } from '../models/Sale.js';
import { Receipt } from '../models/Receipt.js';
import { SaleDetail } from '../models/SaleDetail.js';
import { SaleAddress } from '../models/SaleAddress.js';
import { Product } from '../models/Product.js';
import { Variedad } from '../models/Variedad.js';
import { File } from '../models/File.js';
import { Option } from '../models/Option.js';
import { User } from '../models/User.js';
import { Guest } from '../models/Guest.js';
import { createPrintfulOrderService } from './proveedor/printful/printfulService.js';
import { sendAdminSyncFailedAlert } from './emailNotification.service.js';

/**
 * =====================================================================================
 * AUTO-SYNC SERVICE: Receipt → Sale → Printful
 * 
 * Este servicio es el CORAZÓN de la automatización Order-to-Fulfillment.
 * 
 * Flujo:
 * 1️⃣ Recibe un Sale ID
 * 2️⃣ Valida que exista un Receipt con status='pagado'
 * 3️⃣ Fetch Sale completo con todas las relaciones necesarias
 * 4️⃣ Valida que tenga dirección de envío y productos válidos
 * 5️⃣ Mapea los datos al formato esperado por Printful API
 * 6️⃣ Envía la orden a Printful (modo draft)
 * 7️⃣ Actualiza Sale con printfulOrderId, syncStatus, y timestamps
 * 8️⃣ Retorna resultado detallado (éxito o error clasificado)
 * 
 * Casos de error clasificados:
 * - NO_RECEIPT: No existe un Receipt para esta venta
 * - PAYMENT_NOT_CONFIRMED: El Receipt existe pero status != 'pagado'
 * - SALE_NOT_FOUND: No se encontró la venta con ese ID
 * - NO_ADDRESS: La venta no tiene dirección de envío
 * - NO_PRODUCTS: La venta no tiene productos
 * - INVALID_PRODUCTS: Los productos no tienen variant_id válido
 * - PRINTFUL_ERROR: Error en la API de Printful (contiene detalles)
 * - ALREADY_SYNCED: La venta ya fue sincronizada anteriormente
 * 
 * =====================================================================================
 */

export const autoSyncOrderToPrintful = async (saleId) => {
  try {
    console.log(`\n🚀 [AUTO-SYNC] Iniciando sincronización para Sale ID: ${saleId}`);

    // ========== PASO 1: Validar Receipt ========== //
    console.log('📋 [AUTO-SYNC] PASO 1: Validando Receipt...');
    
    const receipt = await Receipt.findOne({
      where: { saleId }
    });

    if (!receipt) {
      console.error(`❌ [AUTO-SYNC] No existe Receipt para Sale ID: ${saleId}`);
      return {
        success: false,
        errorType: 'NO_RECEIPT',
        message: 'No se encontró un recibo de pago para esta venta',
        saleId
      };
    }

    // Aceptar tanto 'paid' (Stripe webhook) como 'pagado' (español)
    const validPaidStatuses = ['paid', 'pagado'];
    if (!validPaidStatuses.includes(receipt.status)) {
      console.error(`❌ [AUTO-SYNC] Receipt existe pero status='${receipt.status}' (esperado: 'paid' o 'pagado')`);
      return {
        success: false,
        errorType: 'PAYMENT_NOT_CONFIRMED',
        message: `El pago no está confirmado. Estado actual: ${receipt.status}`,
        saleId,
        receiptStatus: receipt.status
      };
    }

    console.log(`✅ [AUTO-SYNC] Receipt válido encontrado (ID: ${receipt.id}, Amount: €${receipt.amount})`);

    // ========== PASO 2: Fetch Sale completo ========== //
    console.log('🔍 [AUTO-SYNC] PASO 2: Obteniendo datos completos de Sale...');
    
    const sale = await Sale.findByPk(saleId, {
      include: [
        {
          model: SaleDetail,
          include: [
            { model: Product },
            { model: Variedad }
          ]
        },
        { model: SaleAddress },
        {
          model: User,
          attributes: ['id', 'name', 'surname', 'email']
        },
        {
          model: Guest,
          attributes: ['id', 'name', 'email']
        }
      ]
    });

    if (!sale) {
      console.error(`❌ [AUTO-SYNC] Sale no encontrado: ${saleId}`);
      return {
        success: false,
        errorType: 'SALE_NOT_FOUND',
        message: 'Venta no encontrada',
        saleId
      };
    }

    console.log(`✅ [AUTO-SYNC] Sale encontrado: ${sale.n_transaction}`);

    // ========== PASO 3: Validar que no esté ya sincronizado ========== //
    if (sale.printfulOrderId) {
      console.warn(`⚠️ [AUTO-SYNC] Sale ya fue sincronizado anteriormente (Printful Order ID: ${sale.printfulOrderId})`);
      return {
        success: false,
        errorType: 'ALREADY_SYNCED',
        message: 'Esta venta ya fue sincronizada con Printful',
        saleId,
        printfulOrderId: sale.printfulOrderId,
        printfulStatus: sale.printfulStatus
      };
    }

    // ========== PASO 4: Validar dirección de envío ========== //
    console.log('📍 [AUTO-SYNC] PASO 3: Validando dirección de envío...');
    
    const address = sale.sale_addresses && sale.sale_addresses[0];
    
    if (!address || !address.name || !address.address || !address.ciudad || !address.email || !address.telefono) {
      console.error(`❌ [AUTO-SYNC] Dirección de envío incompleta`);
      return {
        success: false,
        errorType: 'NO_ADDRESS',
        message: 'La venta no tiene una dirección de envío válida',
        saleId,
        addressData: address
      };
    }

    console.log(`✅ [AUTO-SYNC] Dirección válida: ${address.name}, ${address.ciudad}`);

    // ========== PASO 5: Validar productos ========== //
    console.log('📦 [AUTO-SYNC] PASO 4: Validando productos...');
    
    const saleDetails = sale.sale_details || [];
    
    if (!saleDetails || saleDetails.length === 0) {
      console.error(`❌ [AUTO-SYNC] Sale no tiene productos`);
      return {
        success: false,
        errorType: 'NO_PRODUCTS',
        message: 'La venta no tiene productos asociados',
        saleId
      };
    }

    console.log(`✅ [AUTO-SYNC] ${saleDetails.length} productos encontrados`);

    // ========== PASO 6: Mapear productos a formato Printful ========== //
    console.log('🔄 [AUTO-SYNC] PASO 5: Mapeando productos a formato Printful...');
    
    const printfulItems = [];
    
    for (const detail of saleDetails) {
      const variedad = detail.variedad;
      
      if (!variedad || !variedad.variant_id) {
        console.error(`❌ [AUTO-SYNC] Producto sin variant_id (SaleDetail ID: ${detail.id})`);
        return {
          success: false,
          errorType: 'INVALID_PRODUCTS',
          message: `Producto sin variant_id válido (SaleDetail ID: ${detail.id})`,
          saleId,
          detailId: detail.id
        };
      }

      // Obtener archivos del producto (solo los que se van a imprimir)
      const files = await File.findAll({
        where: { varietyId: variedad.id }
      });

      const printFiles = files
        .filter(file => file.type !== "preview")
        .map(file => ({
          url: file.preview_url,
          type: file.type,
          filename: file.filename
        }));

      // Obtener opciones (para productos bordados)
      const options = await Option.findAll({
        where: { varietyId: variedad.id }
      });

      const itemOptions = options.reduce((opts, option) => {
        let optionValue = option.value;
        try {
          optionValue = JSON.parse(option.value);
        } catch (e) {
          // Si no es JSON, usar valor directo
        }

        if (option.idOption === 'stitch_color') {
          opts[option.idOption] = ['white', 'black'].includes(optionValue) ? optionValue : 'white';
        } else if (option.idOption.startsWith('thread_colors')) {
          opts[option.idOption] = Array.isArray(optionValue) ? optionValue : [optionValue];
        } else {
          opts[option.idOption] = Array.isArray(optionValue) ? optionValue[0] : optionValue;
        }
        return opts;
      }, {});

      const printfulItem = {
        variant_id: variedad.variant_id,
        quantity: detail.cantidad,
        name: detail.product ? detail.product.title : 'Producto',
        retail_price: detail.price_unitario.toString(),
        files: printFiles
      };

      // Solo añadir options si hay opciones válidas
      if (Object.keys(itemOptions).length > 0) {
        printfulItem.options = itemOptions;
      }

      printfulItems.push(printfulItem);
      
      console.log(`  ✅ Producto mapeado: ${printfulItem.name} (variant_id: ${printfulItem.variant_id}, qty: ${printfulItem.quantity})`);
    }

    // ========== PASO 7: Crear objeto de orden Printful ========== //
    console.log('📝 [AUTO-SYNC] PASO 6: Creando objeto de orden Printful...');
    
    const printfulOrderData = {
      external_id: saleId.toString(),
      shipping: 'STANDARD',
      recipient: {
        name: address.name,
        address1: address.address,
        city: address.ciudad,
        state_code: address.provincia || 'CA',
        country_code: address.pais || 'ES',
        zip: address.zipcode || '28001',
        phone: address.telefono,
        email: address.email
      },
      items: printfulItems,
      retail_costs: {
        subtotal: sale.total.toString(),
        discount: '0.00',
        shipping: '0.00',
        tax: '0.00'
      }
    };

    console.log(`✅ [AUTO-SYNC] Orden Printful preparada (External ID: ${saleId}, Items: ${printfulItems.length})`);

    // ========== PASO 8: Enviar a Printful ========== //
    console.log('📤 [AUTO-SYNC] PASO 7: Enviando orden a Printful...');
    
    let printfulResponse;
    
    try {
      printfulResponse = await createPrintfulOrderService(printfulOrderData);
      
      if (!printfulResponse || !printfulResponse.orderId) {
        throw new Error('Respuesta inválida de Printful API');
      }
      
      console.log(`✅ [AUTO-SYNC] Orden creada en Printful exitosamente`);
      console.log(`   📋 Printful Order ID: ${printfulResponse.orderId}`);
      console.log(`   🚚 Shipping: ${printfulResponse.shippingServiceName}`);
      console.log(`   💰 Shipping Cost: €${printfulResponse.shippingCost}`);
      console.log(`   📅 Delivery: ${printfulResponse.minDeliveryDate} - ${printfulResponse.maxDeliveryDate}`);
      
    } catch (printfulError) {
      console.error(`❌ [AUTO-SYNC] Error en Printful API:`, printfulError.message);
      
      // Guardar error en Sale
      await sale.update({
        syncStatus: 'failed',
        errorMessage: printfulError.message,
        printfulUpdatedAt: new Date()
      });
      
      // 📧 Enviar alerta al admin
      try {
        // Determinar datos del cliente
        let customerName, customerEmail, customerType;
        if (sale.user) {
          customerName = `${sale.user.name} ${sale.user.surname || ''}`.trim();
          customerEmail = sale.user.email;
          customerType = 'Usuario Registrado';
        } else if (sale.guest) {
          customerName = sale.guest.name || 'Cliente';
          customerEmail = sale.guest.email;
          customerType = 'Invitado';
        }

        const saleData = {
          id: sale.id,
          n_transaction: sale.n_transaction,
          printfulOrderId: sale.printfulOrderId,
          total: sale.total,
          method_payment: sale.method_payment,
          created: sale.createdAt,
          customer: {
            name: customerName,
            email: customerEmail,
            type: customerType
          }
        };

        const errorData = {
          type: 'PRINTFUL_API_ERROR',
          message: printfulError.message,
          retryCount: 1,
          context: {
            api_response: printfulError.response?.data || 'No response data',
            timestamp: new Date().toISOString()
          }
        };

        const emailResult = await sendAdminSyncFailedAlert(saleData, errorData, receipt);
        
        if (emailResult.success) {
          console.log(`📧 [AUTO-SYNC] Email de alerta enviado al admin`);
        } else {
          console.error(`❌ [AUTO-SYNC] Error enviando email de alerta: ${emailResult.error}`);
        }
      } catch (emailError) {
        console.error('❌ [AUTO-SYNC] Error enviando email de alerta (no crítico):', emailError);
      }
      
      return {
        success: false,
        errorType: 'PRINTFUL_ERROR',
        message: 'Error al crear orden en Printful',
        saleId,
        printfulError: printfulError.message
      };
    }

    // ========== PASO 9: Actualizar Sale con datos de Printful ========== //
    console.log('💾 [AUTO-SYNC] PASO 8: Actualizando Sale con datos de Printful...');
    
    await sale.update({
      printfulOrderId: printfulResponse.orderId.toString(),
      printfulStatus: printfulResponse.raw.status || 'draft',
      printfulUpdatedAt: new Date(),
      syncStatus: 'pending', // Esperando fulfillment
      minDeliveryDate: printfulResponse.minDeliveryDate,
      maxDeliveryDate: printfulResponse.maxDeliveryDate,
      errorMessage: null // Limpiar errores previos
    });

    console.log(`✅ [AUTO-SYNC] Sale actualizado exitosamente`);
    console.log(`\n🎉 [AUTO-SYNC] ¡Sincronización completada para Sale ID: ${saleId}!\n`);

    // ========== PASO 10: Retornar resultado exitoso ========== //
    return {
      success: true,
      saleId,
      printfulOrderId: printfulResponse.orderId,
      printfulStatus: printfulResponse.raw.status,
      shippingService: printfulResponse.shippingServiceName,
      shippingCost: printfulResponse.shippingCost,
      deliveryDates: {
        min: printfulResponse.minDeliveryDate,
        max: printfulResponse.maxDeliveryDate
      },
      dashboardUrl: printfulResponse.dashboardUrl,
      message: 'Orden sincronizada exitosamente con Printful'
    };

  } catch (error) {
    console.error(`❌ [AUTO-SYNC] Error inesperado:`, error);
    
    return {
      success: false,
      errorType: 'UNKNOWN',
      message: 'Error inesperado al sincronizar orden',
      saleId,
      error: error.message
    };
  }
};
