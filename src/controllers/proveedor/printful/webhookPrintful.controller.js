import crypto from 'crypto';
import { PrintfulWebhookLog } from "../../../models/PrintfulWebhookLog.js";
import { Sale } from "../../../models/Sale.js";
import { SaleDetail } from "../../../models/SaleDetail.js";
import { SaleAddress } from "../../../models/SaleAddress.js";
import { Product } from "../../../models/Product.js";
import { Variedad } from "../../../models/Variedad.js";
import { User } from "../../../models/User.js";
import { Guest } from "../../../models/Guest.js";
import { Receipt } from "../../../models/Receipt.js";
import { Tenant } from "../../../models/Tenant.js";
import { sendOrderShippedEmail, sendOrderPrintingEmail, sendAdminSyncFailedAlert, sendOrderDeliveredEmail } from "../../../services/emailNotification.service.js";

/**
 * 🔔 Recibir y procesar webhooks de Printful
 * Endpoint público: POST /api/printful/webhook (legacy - tienda principal)
 * Endpoint multi-tenant: POST /api/printful/webhook/:tenantId (para tenants SaaS)
 */
export const handleWebhook = async (req, res) => {
  try {
    console.log('🔔 [WEBHOOK] Recibido webhook de Printful');
    
    const webhookData = req.body;
    const signature = req.headers['x-printful-signature'];
    const tenantId = req.params.tenantId; // 🏢 Multi-tenant support
    
    // 🏢 0️⃣ Determinar credenciales a usar (tenant o principal)
    let webhookToken = process.env.PRINTFUL_WEBHOOK_TOKEN || null;
    let tenant = null;
    
    if (tenantId) {
      console.log(`🏢 [WEBHOOK] Buscando tenant ID: ${tenantId}`);
      tenant = await Tenant.findByPk(tenantId);
      
      if (!tenant) {
        console.error(`❌ [WEBHOOK] Tenant no encontrado: ${tenantId}`);
        return res.status(404).json({ error: 'Tenant not found' });
      }
      
      if (tenant.status !== 'active' && tenant.status !== 'trial') {
        console.error(`❌ [WEBHOOK] Tenant inactivo: ${tenantId} (status: ${tenant.status})`);
        return res.status(403).json({ error: 'Tenant is not active' });
      }
      
      // Buscar webhook token (opcional - si no existe, se acepta sin verificación)
      webhookToken = tenant.settings?.printful_webhook_token || null;
      
      if (webhookToken) {
        console.log(`✅ [WEBHOOK] Usando verificación de firma para tenant: ${tenant.name}`);
      } else {
        console.log(`⚠️ [WEBHOOK] Sin verificación de firma para tenant: ${tenant.name} (webhook token no configurado)`);
      }
    } else {
      console.log('🔄 [WEBHOOK] Usando credenciales de la tienda principal (legacy)');
    }
    
    // 1️⃣ Verificar firma (solo si webhookToken está configurado)
    if (webhookToken && !verifyWebhookSignature(req, signature, webhookToken)) {
      console.error('❌ [WEBHOOK] Firma inválida');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // 2️⃣ Extraer información del evento
    const eventType = webhookData.type;
    const orderId = webhookData.data?.order?.id || webhookData.data?.id;
    
    console.log(`📦 [WEBHOOK] Evento: ${eventType} | Order ID: ${orderId}`);

    // 3️⃣ Guardar log del webhook
    const webhookLog = await PrintfulWebhookLog.create({
      event_type: eventType,
      order_id: orderId,
      event_data: webhookData,
      received_at: new Date()
    });

    // 4️⃣ Procesar el evento según su tipo
    let processed = false;
    let error = null;

    try {
      switch (eventType) {
        case 'package_shipped':
          processed = await handlePackageShipped(webhookData, webhookLog, tenant);
          break;

        case 'package_delivered':
          processed = await handlePackageDelivered(webhookData, webhookLog, tenant);
          break;

        case 'order_failed':
          processed = await handleOrderFailed(webhookData, webhookLog);
          break;

        case 'order_updated':
          processed = await handleOrderUpdated(webhookData, webhookLog);
          break;

        case 'product_synced':
          processed = await handleProductSynced(webhookData, webhookLog);
          break;

        case 'order_created':
          processed = await handleOrderCreated(webhookData, webhookLog, tenant);
          break;

        default:
          console.log(`ℹ️ [WEBHOOK] Evento no manejado: ${eventType}`);
          processed = true; // Marcar como procesado para no repetir
      }
    } catch (processingError) {
      console.error('❌ [WEBHOOK] Error procesando evento:', processingError);
      error = processingError.message;
    }

    // 5️⃣ Actualizar estado del log solo si no fue actualizado por el handler
    if (processed !== null) {
      await webhookLog.update({
        processed,
        processing_error: error
      });
    }

    // 6️⃣ Responder a Printful (debe ser 200 OK)
    return res.status(200).json({
      success: true,
      message: 'Webhook received and processed',
      event_type: eventType,
      webhook_id: webhookLog.id
    });

  } catch (error) {
    console.error('❌ [WEBHOOK] Error general:', error);
    
    // Importante: Responder 200 para que Printful no reintente
    return res.status(200).json({
      success: false,
      error: 'Internal processing error',
      message: error.message
    });
  }
};

/**
 * 📦 Paquete enviado - HANDLER PROFESIONAL
 * @param {Object} data - Webhook payload
 * @param {Object} webhookLog - Log del webhook
 * @param {Object} tenant - Tenant object (opcional para multi-tenant)
 */
async function handlePackageShipped(data, webhookLog, tenant = null) {
  console.log('🚚 [WEBHOOK] Procesando package_shipped...');
  
  const order = data.data.order;
  const shipment = data.data.shipment;
  
  // Usar external_id para buscar (tu Sale.id)
  const externalId = order.external_id;
  const printfulOrderId = order.id;

  console.log(`📦 External ID: ${externalId} | Printful ID: ${printfulOrderId}`);

  // Buscar por external_id con includes para email
  const sale = await Sale.findOne({
    where: { id: externalId },
    include: [
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

  if (sale) {
    // ✅ Actualización completa con tracking info
    await sale.update({
      printfulOrderId: printfulOrderId,
      printfulStatus: 'shipped',
      syncStatus: 'shipped',
      trackingNumber: shipment.tracking_number,
      trackingUrl: shipment.tracking_url,
      carrier: shipment.carrier,
      shippedAt: new Date(shipment.shipped_at || new Date()),
      printfulUpdatedAt: new Date(),
      errorMessage: null // Limpiar error anterior si existía
    });
    
    console.log(`📦 [WEBHOOK] Orden #${sale.id} marcada como enviada`);
    console.log(`   📍 Tracking: ${shipment.tracking_number}`);
    console.log(`   🚚 Carrier: ${shipment.carrier}`);
    
    // 📧 Enviar email al cliente con tracking
    try {
      // Obtener detalles completos para el email
      const saleDetails = await SaleDetail.findAll({
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
      });

      const saleAddress = await SaleAddress.findOne({
        where: { saleId: sale.id }
      });

      // Determinar email y nombre del cliente
      let customerEmail, customerName;
      if (sale.user) {
        customerEmail = sale.user.email;
        customerName = `${sale.user.name} ${sale.user.surname || ''}`.trim();
      } else if (sale.guest) {
        customerEmail = sale.guest.email;
        customerName = sale.guest.name || 'Cliente';
      }

      if (customerEmail) {
        // Obtener tenant para personalización del email
        let emailTenant = tenant;
        if (!emailTenant && sale.tenant_id) {
          emailTenant = await Tenant.findByPk(sale.tenant_id);
        }
        
        // Preparar productos para el email
        const products = saleDetails.map(detail => ({
          image: `${process.env.URL_BACKEND}/api/products/uploads/product/${detail.product.portada}`,
          title: detail.product.title,
          quantity: detail.cantidad,
          variant: detail.variedad ? detail.variedad.valor : null
        }));

        // Preparar datos para el email
        const emailData = {
          customer: {
            name: customerName,
            email: customerEmail
          },
          order: {
            id: sale.id, // 🔑 ID para tracking
            trackingToken: sale.trackingToken, // 🔒 Token para tracking
            printfulOrderId: sale.printfulOrderId,
            n_transaction: sale.n_transaction,
            created: sale.createdAt,
            total: sale.total,
            currency: sale.currency_payment || 'EUR'
          },
          shipment: {
            trackingNumber: shipment.tracking_number,
            trackingUrl: shipment.tracking_url,
            carrier: shipment.carrier,
            service: shipment.service || 'Standard',
            estimatedDelivery: shipment.estimated_delivery || null,
            shippedDate: shipment.shipped_at || new Date()
          },
          products: products,
          address: {
            name: saleAddress?.name || customerName,
            address: saleAddress?.address || '',
            ciudad: saleAddress?.ciudad || '',
            region: saleAddress?.region || '',
            telefono: saleAddress?.telefono || ''
          },
          tenant: emailTenant // 🏢 Tenant para personalización
        };

        // Enviar email
        const emailResult = await sendOrderShippedEmail(emailData);
        
        if (emailResult.success) {
          console.log(`📧 [WEBHOOK] Email enviado a ${customerEmail}`);
        } else {
          console.error(`❌ [WEBHOOK] Error enviando email: ${emailResult.error}`);
        }
      } else {
        console.warn(`⚠️ [WEBHOOK] No se encontró email del cliente para orden #${sale.id}`);
      }
    } catch (emailError) {
      console.error('❌ [WEBHOOK] Error enviando email (no crítico):', emailError);
      // No fallar el webhook por error de email
    }
    
    return true; // Procesado exitosamente
    
  } else {
    console.warn(`⚠️ [WEBHOOK] Orden con external_id ${externalId} no encontrada en DB`);
    
    // 🏢 Multi-tenant: Crear Sale automáticamente para órdenes externas de tenants
    if (tenant) {
      console.log(`🏢 [WEBHOOK] Tenant ${tenant.id} - Creando Sale para orden externa de Printful`);
      
      try {
        // 2️⃣ Crear Sale con datos del payload
        const trackingToken = crypto.randomBytes(16).toString('hex');
        const orderTotal = parseFloat(order.costs?.total || '0');
        
        const newSale = await Sale.create({
          tenant_id: tenant.id,
          method_payment: 'printful_external',
          n_transaction: `printful_${order.id}`,
          total: orderTotal,
          currency_total: order.costs?.currency || 'USD',
          trackingToken: trackingToken,
          printfulOrderId: order.id,
          printfulStatus: 'shipped',
          syncStatus: 'shipped',
          trackingNumber: shipment.tracking_number,
          trackingUrl: shipment.tracking_url,
          carrier: shipment.carrier,
          shippedAt: new Date(shipment.shipped_at || new Date()),
          printfulUpdatedAt: new Date()
        });
        
        console.log(`✅ [WEBHOOK] Sale creado: ID ${newSale.id} para tenant ${tenant.id}`);
        
        // 2.1️⃣ Crear SaleAddress con datos del recipient
        try {
          // Dividir name en nombre y apellido (o usar placeholder)
          const fullName = order.recipient.name || 'External Customer';
          const nameParts = fullName.trim().split(' ');
          const firstName = nameParts[0] || 'External';
          const lastName = nameParts.slice(1).join(' ') || 'Customer';

          await SaleAddress.create({
            saleId: newSale.id,
            name: firstName,
            surname: lastName,
            email: order.recipient.email || 'no-email@external.order',
            telefono: order.recipient.phone || 'N/A',
            pais: order.recipient.country_code || 'XX',
            region: order.recipient.state_name || order.recipient.state_code || 'N/A',
            address: order.recipient.address1 || 'External order',
            referencia: order.recipient.address2 || null,
            ciudad: order.recipient.city || 'N/A',
            zipcode: order.recipient.zip || '00000',
            nota: `External Printful order - ID: ${order.id}`
          });

          console.log(`✅ [WEBHOOK] SaleAddress creado para Sale #${newSale.id}`);
        } catch (addressError) {
          console.error('❌ [WEBHOOK] Error creando SaleAddress (no crítico):', addressError.message);
          // No crítico - continuar con el flujo
        }

        // 2.2️⃣ Crear SaleDetail por cada item (si existen en el payload)
        if (order.items && order.items.length > 0) {
          try {
            let detailsCreated = 0;
            
            for (const item of order.items) {
              try {
                const itemPrice = parseFloat(item.price || item.retail_price || 0);
                const itemQty = parseInt(item.quantity || 1);
                const itemTotal = parseFloat((itemPrice * itemQty).toFixed(2));
                const itemName = item.name || 'External Product';

                await SaleDetail.create({
                  saleId: newSale.id,
                  productId: null,          // ❌ No existe en nuestra DB
                  variedadId: null,         // ❌ No existe en nuestra DB
                  module_id: null,          // ❌ No es módulo
                  cantidad: itemQty,
                  price_unitario: itemPrice,
                  subtotal: itemTotal,
                  total: itemTotal,
                  discount: 0,
                  type_discount: 1,
                  code_cupon: null,
                  code_discount: itemName,  // 🔧 Guardar nombre del producto aquí (temporal)
                  type_campaign: null
                });

                detailsCreated++;
              } catch (itemError) {
                console.error(`❌ [WEBHOOK] Error creando SaleDetail para item ${item.name || item.id}:`, itemError.message);
                // Continuar con los demás items
              }
            }

            console.log(`✅ [WEBHOOK] ${detailsCreated}/${order.items.length} SaleDetail(s) creados para Sale #${newSale.id}`);
          } catch (detailError) {
            console.error('❌ [WEBHOOK] Error creando SaleDetails (no crítico):', detailError.message);
            // No crítico - continuar con el email
          }
        } else {
          console.log(`ℹ️ [WEBHOOK] No hay items en order.items, SaleDetails no creados`);
        }
        
        // 3️⃣ Enviar email al comprador con tracking
        try {
          const emailData = {
            customer: {
              name: order.recipient.name,
              email: order.recipient.email
            },
            order: {
              id: newSale.id, // 🔑 ID para tracking
              trackingToken: newSale.trackingToken, // 🔒 Token para tracking
              printfulOrderId: order.id,
              n_transaction: newSale.n_transaction,
              created: newSale.createdAt,
              total: newSale.total,
              currency: order.costs?.currency || 'USD'
            },
            shipment: {
              trackingNumber: shipment.tracking_number,
              trackingUrl: shipment.tracking_url,
              carrier: shipment.carrier,
              service: shipment.service || 'Standard',
              estimatedDelivery: shipment.estimated_delivery || null,
              shippedDate: shipment.shipped_at || new Date()
            },
            products: [], // Orden externa - no tenemos detalles de productos en DB
            address: {
              name: order.recipient.name,
              address: order.recipient.address1 || '',
              ciudad: order.recipient.city || '',
              region: order.recipient.state_name || order.recipient.state_code || '',
              telefono: order.recipient.phone || ''
            },
            tenant: tenant // 🏢 Tenant para personalización
          };
          
          const emailResult = await sendOrderShippedEmail(emailData);
          
          if (emailResult.success) {
            console.log(`📧 [WEBHOOK] Email enviado a ${order.recipient.email}`);
          } else {
            console.error(`❌ [WEBHOOK] Error enviando email: ${emailResult.error}`);
          }
        } catch (emailError) {
          console.error('❌ [WEBHOOK] Error enviando email (no crítico):', emailError.message);
          // No fallar el webhook por error de email
        }
        
        return true; // Procesado exitosamente
        
      } catch (createError) {
        console.error('❌ [WEBHOOK] Error creando Sale para tenant:', createError);
        await webhookLog.update({
          processed: false,
          processing_error: `Error creating Sale for tenant: ${createError.message}`
        });
        return null;
      }
    }
    
    // 🔄 Legacy: Sin tenant - marcar como orphan
    await webhookLog.update({
      event_type: `orphan_package_shipped`,
      event_data: {
        ...data,
        _orphan_metadata: {
          external_id: externalId,
          printful_order_id: printfulOrderId,
          detected_at: new Date(),
          reason: 'Sale not found in database'
        }
      },
      processed: false,
      processing_error: `Sale with ID ${externalId} not found in database`
    });
    
    return null; // No actualizar más el log (ya actualizado)
  }
}

/**
 * ✅ Paquete entregado - HANDLER PROFESIONAL
 */
async function handlePackageDelivered(data, webhookLog, tenant = null) {
  console.log('✅ [WEBHOOK] Procesando package_delivered...');
  
  const order = data.data.order;
  const shipment = data.data.shipment;
  
  const externalId = order.external_id;
  const printfulOrderId = order.id;

  console.log(`✅ External ID: ${externalId} | Printful ID: ${printfulOrderId}`);

  // Buscar por external_id con includes para email
  let sale = await Sale.findOne({
    where: { id: externalId },
    include: [
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

  // 🏢 Si no encuentra por external_id, buscar por printfulOrderId (órdenes externas)
  if (!sale && printfulOrderId) {
    console.log(`🔍 [WEBHOOK] Buscando orden externa por printfulOrderId: ${printfulOrderId}`);
    sale = await Sale.findOne({
      where: { printfulOrderId: printfulOrderId },
      include: [
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
    
    if (sale) {
      console.log(`✅ [WEBHOOK] Orden externa encontrada: Sale #${sale.id}`);
    }
  }

  if (sale) {
    // ✅ Actualización: marcar como entregado
    await sale.update({
      printfulOrderId: printfulOrderId,
      printfulStatus: 'fulfilled',
      syncStatus: 'delivered',
      deliveredAt: new Date(),
      completedAt: new Date(),
      printfulUpdatedAt: new Date()
    });
    
    console.log(`✅ [WEBHOOK] Orden #${sale.id} marcada como entregada`);
    console.log(`   📍 Fecha entrega: ${new Date().toLocaleDateString('es-ES')}`);
    
    // 📧 Enviar email al cliente
    try {
      // Obtener detalles completos para el email
      const saleDetails = await SaleDetail.findAll({
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
      });

      const saleAddress = await SaleAddress.findOne({
        where: { saleId: sale.id }
      });

      // Determinar email y nombre del cliente
      let customerEmail, customerName;
      if (sale.user) {
        customerEmail = sale.user.email;
        customerName = `${sale.user.name} ${sale.user.surname || ''}`.trim();
      } else if (sale.guest) {
        customerEmail = sale.guest.email;
        customerName = sale.guest.name || 'Cliente';
      } else if (saleAddress) {
        // Orden externa - obtener email de SaleAddress
        customerEmail = saleAddress.email;
        customerName = `${saleAddress.name || ''} ${saleAddress.surname || ''}`.trim() || 'Cliente';
        console.log(`📧 [WEBHOOK] Email obtenido de SaleAddress para orden externa`);
      }

      if (customerEmail) {
        // Obtener tenant para personalización del email
        let emailTenant = tenant;
        if (!emailTenant && sale.tenant_id) {
          emailTenant = await Tenant.findByPk(sale.tenant_id);
        }
        
        // Preparar productos para el email
        const products = saleDetails.map(detail => {
          // Para órdenes externas, los productos pueden no existir en nuestra DB
          if (detail.product) {
            return {
              image: `${process.env.URL_BACKEND}/api/products/uploads/product/${detail.product.portada}`,
              title: detail.product.title,
              quantity: detail.cantidad,
              variant: detail.variedad ? detail.variedad.valor : null
            };
          } else {
            // Producto externo - usar nombre guardado en code_discount
            return {
              image: null, // Sin imagen para productos externos
              title: detail.code_discount || 'External Product',
              quantity: detail.cantidad,
              variant: null
            };
          }
        });

        // Preparar datos para el email
        const emailData = {
          customer: {
            name: customerName,
            email: customerEmail
          },
          order: {
            id: sale.id, // 🔑 ID para tracking
            trackingToken: sale.trackingToken, // 🔒 Token para tracking
            printfulOrderId: sale.printfulOrderId,
            n_transaction: sale.n_transaction,
            created: sale.createdAt,
            total: sale.total,
            currency: sale.currency_payment || 'EUR'
          },
          delivery: {
            deliveredDate: new Date(),
            address: `${saleAddress?.address || ''}, ${saleAddress?.ciudad || ''}, ${saleAddress?.region || ''}`
          },
          products: products,
          tenant: emailTenant // 🏢 Tenant para personalización
        };

        // Enviar email
        const emailResult = await sendOrderDeliveredEmail(emailData);
        
        if (emailResult.success) {
          console.log(`📧 [WEBHOOK] Email de entrega enviado a ${customerEmail}`);
        } else {
          console.error(`❌ [WEBHOOK] Error enviando email: ${emailResult.error}`);
        }
      } else {
        console.warn(`⚠️ [WEBHOOK] No se encontró email del cliente para orden #${sale.id}`);
      }
    } catch (emailError) {
      console.error('❌ [WEBHOOK] Error enviando email (no crítico):', emailError);
      // No fallar el webhook por error de email
    }
    
    return true; // Procesado exitosamente
    
  } else {
    console.warn(`⚠️ [WEBHOOK] Orden con external_id ${externalId} no encontrada en DB`);
    
    // Actualizar el log actual como orphan
    await webhookLog.update({
      event_type: `orphan_package_delivered`,
      event_data: {
        ...data,
        _orphan_metadata: {
          external_id: externalId,
          printful_order_id: printfulOrderId,
          detected_at: new Date(),
          reason: 'Sale not found in database'
        }
      },
      processed: false,
      processing_error: `Sale with ID ${externalId} not found in database`
    });
    
    return null; // No actualizar más el log (ya actualizado)
  }
}

/**
 * ❌ Orden fallida - HANDLER PROFESIONAL
 */
async function handleOrderFailed(data, webhookLog) {
  console.log('❌ [WEBHOOK] Procesando order_failed...');
  
  const order = data.data.order;
  const externalId = order.external_id;
  const printfulOrderId = order.id;
  const errorData = data.data.error || {};
  const reason = errorData.message || errorData.reason || 'Unknown error';

  console.log(`❌ External ID: ${externalId} | Error: ${reason}`);

  const sale = await Sale.findOne({
    where: { id: externalId },
    include: [
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

  // Obtener Receipt si existe
  const receipt = await Receipt.findOne({
    where: { saleId: externalId }
  });

  if (sale) {
    // ✅ Actualización con mensaje de error completo
    await sale.update({
      printfulOrderId: printfulOrderId,
      printfulStatus: 'failed',
      syncStatus: 'failed',
      errorMessage: reason,
      printfulUpdatedAt: new Date()
    });
    
    console.log(`❌ [WEBHOOK] Orden #${sale.id} marcada como fallida`);
    console.log(`   📝 Razón: ${reason}`);
    
    // 🚨 Análisis del error para determinar acción
    const errorType = classifyError(reason);
    console.log(`   🔍 Tipo de error: ${errorType}`);
    
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

      const errorDataForEmail = {
        type: errorType,
        message: reason,
        retryCount: 1,
        context: {
          webhook_error: errorData,
          printful_order_id: printfulOrderId,
          timestamp: new Date().toISOString()
        }
      };

      const emailResult = await sendAdminSyncFailedAlert(saleData, errorDataForEmail, receipt);
      
      if (emailResult.success) {
        console.log(`📧 [WEBHOOK] Email de alerta enviado al admin`);
      } else {
        console.error(`❌ [WEBHOOK] Error enviando email de alerta: ${emailResult.error}`);
      }
    } catch (emailError) {
      console.error('❌ [WEBHOOK] Error enviando email de alerta (no crítico):', emailError);
    }
    
    return true; // Procesado exitosamente
    
  } else {
    console.warn(`⚠️ [WEBHOOK] Orden con external_id ${externalId} no encontrada en DB`);
    
    // Actualizar el log actual como orphan en lugar de crear uno nuevo
    await webhookLog.update({
      event_type: `orphan_order_failed`,
      event_data: {
        ...data,
        _orphan_metadata: {
          external_id: externalId,
          printful_order_id: printfulOrderId,
          detected_at: new Date(),
          reason: 'Sale not found in database'
        }
      },
      processed: false,
      processing_error: `Sale with ID ${externalId} not found in database`
    });
    
    return null; // No actualizar más el log (ya actualizado)
  }
}

/**
 * 🔍 Clasificar tipo de error para determinar acción
 */
function classifyError(errorMessage) {
  const msg = errorMessage.toLowerCase();
  
  if (msg.includes('address') || msg.includes('shipping')) {
    return 'ADDRESS_INVALID'; // Corregible por el cliente
  }
  if (msg.includes('payment') || msg.includes('insufficient')) {
    return 'PAYMENT_ISSUE'; // Requiere acción financiera
  }
  if (msg.includes('discontinued') || msg.includes('out of stock')) {
    return 'PRODUCT_UNAVAILABLE'; // Requiere cambio de producto
  }
  if (msg.includes('artwork') || msg.includes('design')) {
    return 'ARTWORK_REJECTED'; // Requiere revisar diseño
  }
  
  return 'UNKNOWN'; // Requiere revisión manual
}

/**
 * 🔄 Orden actualizada - HANDLER PROFESIONAL
 */
async function handleOrderUpdated(data, webhookLog) {
  console.log('🔄 [WEBHOOK] Procesando order_updated...');
  
  const order = data.data.order;
  const externalId = order.external_id;
  const printfulOrderId = order.id;
  const newStatus = order.status;

  console.log(`🔄 External ID: ${externalId} | Nuevo estado: ${newStatus}`);

  const sale = await Sale.findOne({
    where: { id: externalId }
  });

  if (sale) {
    const oldStatus = sale.printfulStatus;
    
    // Mapear estado de Printful a syncStatus
    let syncStatus = 'pending';
    if (newStatus === 'fulfilled') syncStatus = 'fulfilled';
    if (newStatus === 'canceled' || newStatus === 'cancelled') syncStatus = 'canceled';
    
    // ✅ Actualización con detección de cambio de estado
    await sale.update({
      printfulOrderId: printfulOrderId,
      printfulStatus: newStatus,
      syncStatus: syncStatus,
      printfulUpdatedAt: new Date()
    });
    
    // Si alcanzó estado fulfilled, marcar como completado
    if (newStatus === 'fulfilled' && oldStatus !== 'fulfilled') {
      await sale.update({
        completedAt: new Date()
      });
      console.log(`🎉 [WEBHOOK] Orden #${sale.id} completada (fulfilled)`);
    }
    
    console.log(`✅ [WEBHOOK] Orden #${sale.id}: ${oldStatus} → ${newStatus}`);
    
    return true; // Procesado exitosamente
    
  } else {
    console.warn(`⚠️ [WEBHOOK] Orden con external_id ${externalId} no encontrada en DB`);
    
    // Actualizar el log actual como orphan
    await webhookLog.update({
      event_type: `orphan_order_updated`,
      processed: false,
      processing_error: `Sale with ID ${externalId} not found in database`
    });
    
    return null; // No actualizar más el log
  }
}

/**
 * 🆕 Orden creada - HANDLER PROFESIONAL
 */
async function handleOrderCreated(data, webhookLog, tenant = null) {
  console.log('🆕 [WEBHOOK] Procesando order_created...');
  
  const order = data.data.order;
  const externalId = order.external_id;
  const printfulOrderId = order.id;
  const status = order.status;

  console.log(`🆕 External ID: ${externalId} | Printful ID: ${printfulOrderId}`);

  const sale = await Sale.findOne({
    where: { id: externalId },
    include: [
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

  if (sale) {
    // ✅ Confirmar recepción y guardar ID de Printful
    await sale.update({
      printfulOrderId: printfulOrderId,
      printfulStatus: status || 'pending',
      syncStatus: 'pending',
      printfulUpdatedAt: new Date(),
      errorMessage: null // Limpiar error si hubo reintento
    });
    
    console.log(`✅ [WEBHOOK] Orden #${sale.id} confirmada por Printful`);
    console.log(`   🆔 Printful Order ID: ${printfulOrderId}`);
    
    // 📧 Enviar email al cliente notificando que está en producción
    try {
      // Obtener detalles completos para el email
      const saleDetails = await SaleDetail.findAll({
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
      });

      const saleAddress = await SaleAddress.findOne({
        where: { saleId: sale.id }
      });

      // Determinar email y nombre del cliente
      let customerEmail, customerName;
      if (sale.user) {
        customerEmail = sale.user.email;
        customerName = `${sale.user.name} ${sale.user.surname || ''}`.trim();
      } else if (sale.guest) {
        customerEmail = sale.guest.email;
        customerName = sale.guest.name || 'Cliente';
      }

      if (customerEmail) {
        // Obtener tenant para personalización del email
        let emailTenant = tenant;
        if (!emailTenant && sale.tenant_id) {
          emailTenant = await Tenant.findByPk(sale.tenant_id);
        }
        
        // Preparar productos para el email
        const products = saleDetails.map(detail => ({
          image: `${process.env.URL_BACKEND}/api/products/uploads/product/${detail.product.portada}`,
          title: detail.product.title,
          quantity: detail.cantidad,
          variant: detail.variedad ? detail.variedad.valor : null,
          color: detail.variedad ? detail.variedad.color : null
        }));

        // Preparar datos para el email
        const emailData = {
          customer: {
            name: customerName,
            email: customerEmail
          },
          order: {
            id: sale.id, // 🔑 ID para tracking
            trackingToken: sale.trackingToken, // 🔒 Token para tracking
            printfulOrderId: sale.printfulOrderId,
            n_transaction: sale.n_transaction,
            created: sale.createdAt,
            total: sale.total,
            currency: sale.currency_payment || 'EUR'
          },
          products: products,
          address: {
            name: saleAddress?.name || customerName,
            address: saleAddress?.address || '',
            ciudad: saleAddress?.ciudad || '',
            region: saleAddress?.region || '',
            telefono: saleAddress?.telefono || ''
          },
          tenant: emailTenant // 🏢 Tenant para personalización
        };

        // Enviar email
        const emailResult = await sendOrderPrintingEmail(emailData);
        
        if (emailResult.success) {
          console.log(`📧 [WEBHOOK] Email "Order Printing" enviado a ${customerEmail}`);
        } else {
          console.error(`❌ [WEBHOOK] Error enviando email: ${emailResult.error}`);
        }
      } else {
        console.warn(`⚠️ [WEBHOOK] No se encontró email del cliente para orden #${sale.id}`);
      }
    } catch (emailError) {
      console.error('❌ [WEBHOOK] Error enviando email (no crítico):', emailError);
      // No fallar el webhook por error de email
    }
    
    return true; // Procesado exitosamente
    
  } else {
    console.warn(`⚠️ [WEBHOOK] Orden con external_id ${externalId} no encontrada en DB`);
    
    // Actualizar el log actual como orphan
    await webhookLog.update({
      event_type: `orphan_order_created`,
      processed: false,
      processing_error: `Sale with ID ${externalId} not found in database`
    });
    
    return null; // No actualizar más el log
  }
}

/**
 * 📦 Producto sincronizado
 */
async function handleProductSynced(data, webhookLog) {
  console.log('🔄 [WEBHOOK] Procesando product_synced...');
  return true; // Procesado exitosamente
  
  const productId = data.data.sync_product.id;
  console.log(`✅ [WEBHOOK] Producto ${productId} sincronizado`);
  
  // TODO: Actualizar información del producto en DB si es necesario
}

/**
 * 🔐 Verificar firma del webhook (seguridad)
 */
function verifyWebhookSignature(req, signature, webhookSecret) {
  if (!webhookSecret || !signature) {
    return true; // Skip verification si no está configurado
  }

  // Usar rawBody en lugar de JSON.stringify para verificación correcta
  const payload = req.rawBody || Buffer.from(JSON.stringify(req.body));
  const hash = crypto
    .createHmac('sha256', webhookSecret)
    .update(payload)
    .digest('hex');

  return hash === signature;
}

/**
 * 📊 Obtener logs de webhooks
 */
export const getWebhookLogs = async (req, res) => {
  try {
    const { limit = 50, event_type, processed } = req.query;

    const where = {};
    if (event_type) where.event_type = event_type;
    if (processed !== undefined) where.processed = processed === 'true';

    const logs = await PrintfulWebhookLog.findAll({
      where,
      limit: parseInt(limit),
      order: [['received_at', 'DESC']]
    });

    return res.status(200).json({
      success: true,
      count: logs.length,
      logs
    });

  } catch (error) {
    console.error('❌ Error fetching webhook logs:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener logs de webhooks',
      error: error.message
    });
  }
};

// Testing endpoints removed for production

/**
 * 📊 Estadísticas de webhooks
 */
export const getWebhookStats = async (req, res) => {
  try {
    const { Sequelize } = await import('sequelize');
    
    const rawStats = await PrintfulWebhookLog.findAll({
      attributes: [
        'event_type',
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'total'],
        [Sequelize.fn('SUM', Sequelize.literal('CASE WHEN processed = 1 THEN 1 ELSE 0 END')), 'processed'],
        [Sequelize.fn('SUM', Sequelize.literal('CASE WHEN processed = 0 THEN 1 ELSE 0 END')), 'failed']
      ],
      group: ['event_type'],
      raw: true
    });

    // Transformar para que el frontend lo entienda correctamente
    const stats = rawStats.map(stat => ({
      event_type: stat.event_type,
      total: parseInt(stat.total) || 0,
      processed: parseInt(stat.processed) || 0,
      failed: parseInt(stat.failed) || 0
    }));

    const totalCount = await PrintfulWebhookLog.count();

    return res.status(200).json({
      success: true,
      total: totalCount,
      stats: stats
    });

  } catch (error) {
    console.error('❌ Error fetching webhook stats:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas',
      error: error.message
    });
  }
};

// logOrphanWebhook function removed - now we update the existing log instead of creating a new one
