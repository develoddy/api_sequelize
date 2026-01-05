import crypto from 'crypto';
import { Sale } from '../models/Sale.js';
import { SaleDetail } from '../models/SaleDetail.js';
import { SaleAddress } from '../models/SaleAddress.js';
import { Guest } from '../models/Guest.js';
import { User } from '../models/User.js';
import { Cart } from '../models/Cart.js';
import { CartCache } from '../models/CartCache.js';
import { createSaleReceipt } from './helpers/receipt.helper.js';
import { sendEmail } from './sale.controller.js';
import { createPrintfulOrder } from './proveedor/printful/productPrintful.controller.js';

/**
 * POST /api/paypal/webhook
 * Webhook de PayPal para capturar pagos completados
 * Evento: PAYMENT.CAPTURE.COMPLETED
 */
export const paypalWebhook = async (req, res) => {
  console.log('[PayPal Webhook] Webhook recibido');
  console.log('[PayPal Webhook] Event type:', req.body.event_type);

  try {
    const event = req.body;

    // Solo procesar PAYMENT.CAPTURE.COMPLETED
    if (event.event_type !== 'PAYMENT.CAPTURE.COMPLETED') {
      console.log('⚠️ [PayPal Webhook] Ignoring event type:', event.event_type);
      return res.status(200).json({ received: true });
    }

    console.log('✅ [PayPal Webhook] Processing PAYMENT.CAPTURE.COMPLETED event');

    const capture = event.resource;
    const paypalOrderId = capture.supplementary_data?.related_ids?.order_id || capture.id;
    
    console.log('[PayPal Webhook] PayPal Order ID:', paypalOrderId);
    console.log('[PayPal Webhook] Capture ID:', capture.id);
    console.log('[PayPal Webhook] Amount:', capture.amount.value, capture.amount.currency_code);

    // Verificar si la venta ya fue registrada
    const existingSale = await Sale.findOne({
      where: {
        n_transaction: paypalOrderId
      }
    });

    if (existingSale) {
      console.log('[PayPal Webhook] ✅ Sale already registered:', existingSale.id);
      return res.status(200).json({ received: true, sale_id: existingSale.id });
    }

    // 🔥 Intentar obtener detalles completos de la orden desde la API de PayPal
    console.log('[PayPal Webhook] 🔍 Fetching order details from PayPal API...');
    console.log('[PayPal Webhook] 🔍 Order ID to fetch:', paypalOrderId);

    // 🔥 SOLUCIÓN: Obtener detalles completos de la orden desde la API de PayPal
    console.log('[PayPal Webhook] 🔍 Fetching order details from PayPal API...');
    console.log('[PayPal Webhook] 🔍 Order ID to fetch:', paypalOrderId);
    
    const paypalMode = process.env.PAYPAL_MODE || 'sandbox';
    const paypalBaseUrl = paypalMode === 'live' 
      ? 'https://api.paypal.com' 
      : 'https://api.sandbox.paypal.com';
    
    // Obtener access token de PayPal
    const authResponse = await fetch(`${paypalBaseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64')}`
      },
      body: 'grant_type=client_credentials'
    });

    if (!authResponse.ok) {
      console.error('❌ [PayPal Webhook] Failed to get PayPal access token:', authResponse.status);
      return res.status(500).json({ error: 'Failed to authenticate with PayPal' });
    }

    const authData = await authResponse.json();
    const accessToken = authData.access_token;

    if (!accessToken) {
      console.error('❌ [PayPal Webhook] No access token received');
      return res.status(500).json({ error: 'Failed to authenticate with PayPal' });
    }

    // 🔥 ESTRATEGIA 1: Intentar obtener detalles del CAPTURE directamente
    console.log('[PayPal Webhook] 🔍 Trying to get capture details:', capture.id);
    const captureResponse = await fetch(`${paypalBaseUrl}/v2/payments/captures/${capture.id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      }
    });

    let payerEmail = null;
    let payerName = 'Cliente';
    let payerSurname = '';

    if (captureResponse.ok) {
      const captureDetails = await captureResponse.json();
      console.log('[PayPal Webhook] ✅ Capture details fetched');
      
      // Intentar obtener payer info del capture
      if (captureDetails.payer?.email_address) {
        payerEmail = captureDetails.payer.email_address;
        payerName = captureDetails.payer.name?.given_name || 'Cliente';
        payerSurname = captureDetails.payer.name?.surname || '';
        console.log('[PayPal Webhook] ✅ Payer info from capture details');
      }
    } else {
      console.warn('[PayPal Webhook] ⚠️ Could not fetch capture details:', captureResponse.status);
    }

    // 🔥 ESTRATEGIA 2: Si no obtuvimos email del capture, intentar con la orden
    if (!payerEmail) {
      console.log('[PayPal Webhook] 🔍 Trying to get order details:', paypalOrderId);
      const orderResponse = await fetch(`${paypalBaseUrl}/v2/checkout/orders/${paypalOrderId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (orderResponse.ok) {
        const orderDetails = await orderResponse.json();
        console.log('[PayPal Webhook] ✅ Order details fetched');
        
        const payer = orderDetails.payer;
        payerEmail = payer?.email_address || null;
        payerName = payer?.name?.given_name || 'Cliente';
        payerSurname = payer?.name?.surname || '';
      } else {
        console.warn('[PayPal Webhook] ⚠️ Could not fetch order details:', orderResponse.status);
        const errorData = await orderResponse.json();
        console.warn('[PayPal Webhook] ⚠️ Order API error:', JSON.stringify(errorData, null, 2));
      }
    }

    console.log('[PayPal Webhook] Payer email:', payerEmail);
    console.log('[PayPal Webhook] Payer name:', payerName, payerSurname);

    // 🔥 ESTRATEGIA 3: Si aún no tenemos email, esperar a que el frontend llame a /register
    if (!payerEmail) {
      console.warn('⚠️ [PayPal Webhook] No se pudo obtener email del payer');
      console.warn('⚠️ [PayPal Webhook] El frontend debe llamar a /register con los datos completos');
      // No fallar el webhook, solo registrar como pendiente
      return res.status(200).json({ 
        received: true, 
        note: 'Payer email not found, waiting for frontend to register sale'
      });
    }

    // Buscar usuario o guest por email
    let userId = null;
    let guestId = null;

    const user = await User.findOne({ where: { email: payerEmail } });
    if (user) {
      userId = user.id;
      console.log('[PayPal Webhook] User found:', userId);
    } else {
      // Buscar o crear guest
      let guest = await Guest.findOne({ where: { email: payerEmail } });
      if (!guest) {
        // Generar session_id temporal para guest creado desde webhook
        const sessionId = `webhook_${paypalOrderId}_${Date.now()}`;
        
        guest = await Guest.create({
          session_id: sessionId,
          name: payerName,
          surname: payerSurname,
          email: payerEmail
        });
        console.log('[PayPal Webhook] Guest created:', guest.id, 'with session_id:', sessionId);
      } else {
        console.log('[PayPal Webhook] Guest found:', guest.id);
      }
      guestId = guest.id;
    }

    // Crear tracking token
    const trackingToken = crypto.randomBytes(16).toString('hex');

    // Crear venta
    const sale = await Sale.create({
      userId,
      guestId,
      currency_payment: capture.amount.currency_code,
      method_payment: 'PAYPAL',
      n_transaction: paypalOrderId,
      total: parseFloat(capture.amount.value),
      trackingToken,
      country: 'es', // TODO: extraer de metadata si es posible
      locale: 'es'
    });

    console.log('[PayPal Webhook] Sale created:', sale.id);

    // Crear SaleAddress básica
    const saleAddress = await SaleAddress.create({
      saleId: sale.id,
      name: payerName,
      surname: payerSurname,
      email: payerEmail,
      pais: 'ES',
      address: 'PayPal Checkout',
      ciudad: '',
      region: '',
      telefono: '',
      zipcode: ''
    });

    console.log('[PayPal Webhook] SaleAddress created');

    // Crear recibo
    await createSaleReceipt(sale, 'PAYPAL', { captureId: capture.id }, saleAddress);
    console.log('[PayPal Webhook] Receipt created');

    // TODO: Procesar carrito y crear sale details
    // Por ahora, esto solo crea la venta básica
    // El frontend debe seguir llamando a /register con los detalles del carrito

    // Enviar email de confirmación
    try {
      await sendEmail(sale.id);
      console.log('[PayPal Webhook] ✅ Confirmation email sent');
    } catch (emailErr) {
      console.error('[PayPal Webhook] ❌ Email error:', emailErr.message);
    }

    return res.status(200).json({ 
      received: true, 
      sale_id: sale.id 
    });

  } catch (error) {
    console.error('❌ [PayPal Webhook] Error:', error);
    return res.status(500).json({ error: error.message });
  }
};

/**
 * POST /api/paypal/verify-or-create-sale
 * Endpoint para verificar si webhook ya creó la venta, o crearla manualmente
 * Llamado desde frontend en onApprove como fallback
 */
export const verifyOrCreateSale = async (req, res) => {
  try {
    const { paypalOrderId, saleData, saleAddressData, cart } = req.body;

    console.log('[PayPal VerifyOrCreate] Checking for existing sale with paypalOrderId:', paypalOrderId);

    // Buscar venta existente (creada por webhook)
    const existingSale = await Sale.findOne({
      where: { n_transaction: paypalOrderId },
      include: [
        { model: SaleAddress },
        { model: User },
        { model: Guest }
      ]
    });

    if (existingSale) {
      console.log('[PayPal VerifyOrCreate] ✅ Sale already exists (created by webhook):', existingSale.id);
      
      // Obtener detalles
      const saleDetails = await SaleDetail.findAll({
        where: { saleId: existingSale.id }
      });

      return res.status(200).json({
        message: 'Venta ya procesada por webhook',
        sale: existingSale,
        saleDetails,
        createdByWebhook: true
      });
    }

    // Si no existe, crearla manualmente (fallback)
    console.log('[PayPal VerifyOrCreate] No existing sale found, creating manually...');

    // Aquí llamarías a tu lógica actual de register/registerGuest
    // Por ahora, devolver error para que el frontend siga usando el flujo actual
    return res.status(404).json({
      message: 'Sale not found, frontend should call /register',
      shouldCallRegister: true
    });

  } catch (error) {
    console.error('[PayPal VerifyOrCreate] Error:', error);
    return res.status(500).json({ error: error.message });
  }
};
