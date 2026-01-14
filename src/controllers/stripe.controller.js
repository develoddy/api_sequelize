import { Op, Sequelize } from 'sequelize';
import Stripe from 'stripe';
import crypto from 'crypto';
import { Sale } from '../models/Sale.js';
import { Receipt } from '../models/Receipt.js';
import { SaleDetail } from '../models/SaleDetail.js';
import { Variedad } from '../models/Variedad.js';
import { Cart } from '../models/Cart.js';
import { CartCache } from '../models/CartCache.js';
import { CheckoutCache } from '../models/CheckoutCache.js';
import { Guest } from '../models/Guest.js';
import { User } from '../models/User.js';
import { SaleAddress } from '../models/SaleAddress.js';
import { File } from '../models/File.js';
import { Option } from '../models/Option.js';
import { Cupone } from '../models/Cupone.js';
import { Tenant } from '../models/Tenant.js';
import { Module } from '../models/Module.js';
import { StripeWebhookLog } from '../models/StripeWebhookLog.js';

import { createPrintfulOrder } from './proveedor/printful/productPrintful.controller.js';
import { createSaleReceipt } from './helpers/receipt.helper.js';
import { sendEmail } from './sale.controller.js';
import { 
  sendPaymentSuccessEmail, 
  sendSubscriptionCancelledEmail, 
  sendAccessLostEmail 
} from './saas-email.controller.js';

import stripe from '../devtools/utils/stripe.js';

// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
//   apiVersion: '2023-10-16', // o la que uses
// });

/**
 * Formatea precio a 2 decimales exactos usando redondeo estándar
 * Mantiene consistencia con Printful, frontend y base de datos
 * @param {number} price - Precio a formatear
 * @returns {number} Precio con 2 decimales exactos
 */
const formatPrice = (price) => {
  if (!price || price <= 0) {
    return 0.00;
  }
  return parseFloat(price.toFixed(2));
};

/**
 * POST /api/stripe/create-checkout-session
 * Crea una sesión de pago de Stripe Checkout
 */
export const createCheckoutSession = async (req, res) => {
  try {
    const { cart, userId, guestId, address, country, locale, moduleId, moduleKey } = req.body;
    
    // 🐛 DEBUG: Log completo del request body
    console.log('🔍 [Stripe] Request body recibido:', JSON.stringify({
      hasCart: !!cart,
      cartLength: cart?.length,
      userId,
      guestId,
      moduleId,
      moduleKey,
      country,
      locale
    }, null, 2));
    
    // 🆕 Detectar si es compra de módulo
    const isModulePurchase = !!moduleId;
    
    // Extraer country/locale del request (con fallback)
    const requestCountry = country || req.headers['x-country'] || 'es';
    const requestLocale = locale || req.headers['x-locale'] || 'es';

    // Normalize userId/guestId to simple scalar strings for Stripe metadata
    const normalizeIdForMetadata = (id) => {
      try {
        if (!id && id !== 0) return '';
        // If an object was passed (e.g., full user object), try to pick numeric id fields
        if (typeof id === 'object') {
          return String(id.id ?? id._id ?? id.userId ?? '');
        }
        return String(id);
      } catch (e) {
        return '';
      }
    };

    const metadataUserId = normalizeIdForMetadata(userId);
    const metadataGuestId = normalizeIdForMetadata(guestId);
    console.log('[Stripe] Metadata to be attached - userId:', metadataUserId, 'guestId:', metadataGuestId, 'moduleId:', moduleId || 'none');

    // 🆕 Validación diferenciada según tipo de compra
    if (isModulePurchase) {
      // Compra de módulo: no requiere cart
      if (!moduleId || !moduleKey) {
        return res.status(400).json({ 
          message: "Falta información del módulo (moduleId, moduleKey)" 
        });
      }
    } else {
      // Compra Printful: requiere cart
      if ( !cart || cart.length === 0 ) {
        return res.status(400).json({ 
          message: "El carrito está vacío" 
        });
      }
    }

    // VALIDA QUE AL MENOS HAYA UN IDENTIFICADOR DE CLIENTE
    if ( !userId && !guestId ) {
      return res.status(400).json({ 
        message: "Falta información de usuario o invitado" 
      });
    }

    // 🆕 Crear line items según tipo de compra
    let lineItems;
    
    if (isModulePurchase) {
      // Compra de módulo: crear line item desde el módulo
      const { Module } = await import('../models/Module.js');
      const module = await Module.findByPk(moduleId);
      
      if (!module) {
        return res.status(404).json({ message: "Módulo no encontrado" });
      }
      
      // 🔧 Permitir compras en estado 'testing' y 'live', bloquear solo 'draft' y 'archived'
      if (!module.is_active || (module.status !== 'live' && module.status !== 'testing')) {
        return res.status(400).json({ 
          message: "Módulo no disponible para compra",
          details: `Estado actual: ${module.status}, Activo: ${module.is_active}`
        });
      }
      
      lineItems = [{
        price_data: {
          currency: "eur",
          product_data: {
            name: module.name,
            description: module.description || ''
          },
          unit_amount: Math.round(module.base_price * 100), // Precio en centavos
        },
        quantity: 1,
      }];
    } else {
      // Compra Printful: usar cart actual
      lineItems = cart.map((item) => {
        // Usar el precio final si viene procesado desde el frontend (incluye descuentos)
        // Si no existe finalPrice, usar el precio original como fallback
        const finalPrice = item.finalPrice || Number(
          (item.variedad && item.variedad.retail_price != null)
            ? item.variedad.retail_price
            : (item.product && item.product.price_usd != null)
              ? item.product.price_usd
              : item.price_unitario
        );

        // Agregar información de descuento en la descripción si aplica
        let productName = item.product.title;
        if (item.hasDiscount && item.originalPrice && item.finalPrice) {
          productName += ` (Rebajado de €${item.originalPrice.toFixed(2)} a €${item.finalPrice.toFixed(2)})`;
        }

        return {
          price_data: {
            currency     : "eur",
            product_data : {
              name : productName,
            },
            // finalPrice in euros, convert to cents
            unit_amount  : Math.round(finalPrice * 100),
          },
          quantity: item.cantidad,
        };
      });
    }


    // 🆕 Solo sanitizar cart si NO es compra de módulo
    let sanitizedCart = [];
    
    if (!isModulePurchase) {
      // Debug: Log cart payload to see coupon structure and finalPrice
      console.log('[Stripe] Cart payload preview (first item):', cart && cart[0] ? {
        code_cupon: cart[0].code_cupon,
        code_discount: cart[0].code_discount,
        discount: cart[0].discount,
        type_discount: cart[0].type_discount,
        finalPrice: cart[0].finalPrice,
        originalPrice: cart[0].originalPrice,
        hasDiscount: cart[0].hasDiscount,
        price_unitario: cart[0].price_unitario
      } : 'no items');

      // Normalize/sanitize cart items to ensure productId and variedadId are present
      sanitizedCart = (Array.isArray(cart) ? cart : []).map((item) => ({
      productId: item.product?.id ?? item.productId ?? null,
      variedadId: item.variedad?.id ?? item.variedadId ?? null,
      cantidad: item.cantidad ?? item.quantity ?? 1,
      price_unitario: item.price_unitario ?? item.variedad?.retail_price ?? item.product?.price_usd ?? item.price ?? 0,
      finalPrice: item.finalPrice ?? null,
      originalPrice: item.originalPrice ?? null,  // 🔧 PRESERVE originalPrice from frontend
      hasDiscount: item.hasDiscount ?? false,  // 🔧 PRESERVE hasDiscount from frontend
      discount: item.discount ?? 0,
      type_discount: item.type_discount ?? null,
      code_cupon: item.code_cupon ?? null,
      code_discount: item.code_discount ?? null,  // ADD: preserve Flash Sale IDs
      type_campaign: item.type_campaign ?? null,   // <-- Propaga type_campaign
      title: item.product?.title ?? item.title ?? '',
        // Preserve any additional fields that might be useful later
        subtotal: item.subtotal ?? null,
        total: item.total ?? null
      }));
    }

    // Persist full sanitized cart/module data and address in CheckoutCache
    let checkoutCache = null;
    try {
      const payloadToStore = isModulePurchase 
        ? { moduleId, moduleKey, address: address || null } // 🆕 Módulo
        : { items: sanitizedCart, address: address || null }; // Printful
      
      checkoutCache = await CheckoutCache.create({
        userId: userId || null,
        guestId: guestId || null,
        cart: JSON.stringify(payloadToStore)
      });
      console.log('[Stripe] CheckoutCache created id=', checkoutCache.id, 'isModule:', isModulePurchase);
    } catch (cacheErr) {
      console.warn('[Stripe] Could not create CheckoutCache, falling back to metadata cart (may fail on large carts):', cacheErr);
    }
    
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode        : "payment",
      line_items  : lineItems,
      // URLs dinámicas usando country/locale del request
      success_url : `${process.env.URL_FRONTEND}/${requestCountry}/${requestLocale}/account/checkout/successfull?initialized=true&from=step4&fromStripe=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url  : `${process.env.URL_FRONTEND}/${requestCountry}/${requestLocale}/account/checkout/payment?initialized=true&from=step3`,
      metadata    : {
        // always send strings in metadata; choose normalized values
        userId  : metadataUserId || "",
        guestId : metadataGuestId || "",
        email   : address?.email || "",
        // 🆕 Añadir module info si es compra de módulo
        ...(isModulePurchase && {
          moduleId: String(moduleId),
          moduleKey: String(moduleKey)
        }),
        country : requestCountry, // 🌍 País de contexto
        locale  : requestLocale,  // 🌍 Idioma de contexto
        // Prefer lightweight cartId reference to the stored CheckoutCache when possible
        ...(checkoutCache ? { cartId: String(checkoutCache.id) } : { cart: JSON.stringify(sanitizedCart) })
      },
    });

  console.log('[Stripe] Checkout session created:', { id: session.id, metadataPreview: session.metadata });

  res.json({ id: session.id });

  } catch (error) {
    console.error("Error al crear sesión de Stripe:", error);
    res.status(500).json({
      message: "Error al iniciar la sesión de pago con Stripe.",
    });
  }
};

/**
 * GET /api/stripe/session/:sessionId
 * Recupera una sesión de Stripe Checkout existente
 */
export const getCheckoutSession = async (req, res) => {
  try {
    
    const { sessionId } = req.params;
    const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ['line_items'] });
  
  res.json(session);
  } catch (error) {
    console.error('Error al recuperar sesión de Stripe:', error);
    res.status(500).json({ message: 'Error al obtener la sesión de Stripe.' });
  }
};


export const stripeWebhook = async (req, res) => {
  console.log('[Stripe Webhook] Webhook recibido');
  console.log('[Stripe Webhook] req.headers:', JSON.stringify(req.headers || {}, null, 2));
  const sig = req.headers['stripe-signature'];
  let event;
  let webhookLog = null;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    
    // 📝 Crear log del webhook recibido
    webhookLog = await StripeWebhookLog.createFromEvent(event);
    console.log(`📝 [Stripe Webhook] Log creado con ID ${webhookLog.id} para evento ${event.id}`);
    
  } catch (err) {
    console.error('❌ [Stripe Webhook] Webhook signature verification failed:', err);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log('🎯 [Stripe Webhook] Event type received:', event.type);

  // Marcar webhook como en procesamiento
  await webhookLog.markAsProcessing();

  try {
    // ✅ Manejar checkout.session.completed (compras únicas y primera subscripción)
    if (event.type === 'checkout.session.completed') {
      await handleCheckoutCompleted(event, res, webhookLog);
      return;
    }

    // 🆕 Manejar eventos de subscripciones SaaS
    if (event.type === 'invoice.paid') {
      await handleInvoicePaid(event, res, webhookLog);
      return;
    }

    if (event.type === 'customer.subscription.updated') {
      await handleSubscriptionUpdated(event, res, webhookLog);
      return;
    }

    if (event.type === 'customer.subscription.deleted') {
      await handleSubscriptionDeleted(event, res, webhookLog);
      return;
    }

    console.log('⚠️ [Stripe Webhook] Ignoring event type:', event.type);
    await webhookLog.markAsSuccess('Event type ignored (not relevant)');
    return res.json({ received: true });
    
  } catch (error) {
    console.error('❌ [Stripe Webhook] Error processing webhook:', error);
    await webhookLog.markAsFailed(error.message);
    return res.status(500).json({ error: error.message });
  }
};

/**
 * Manejar evento checkout.session.completed
 * (Compras Printful y primera creación de subscripción SaaS)
 */
async function handleCheckoutCompleted(event, res, webhookLog) {
  console.log('✅ [Stripe Webhook] Processing checkout.session.completed event');
  const session = event.data.object;

  console.log('[Stripe Webhook] session object (summary):', {
    id: session.id,
    amount_total: session.amount_total,
    currency: session.currency,
    metadata: session.metadata
  });

  const userId = Number(session.metadata.userId) || null;
  const guestId = Number(session.metadata.guestId) || null;
  
  // 🆕 Detectar si es subscripción SaaS
  const tenantId = session.metadata.tenantId ? Number(session.metadata.tenantId) : null;
  const isSaasSubscription = session.metadata.type === 'saas_subscription' && tenantId;
  
  // 🆕 Si es subscripción SaaS, manejar y retornar temprano
  if (isSaasSubscription) {
    console.log('🚀 [Stripe Webhook] Processing SaaS subscription checkout:', {
      tenantId,
      moduleKey: session.metadata.moduleKey,
      planName: session.metadata.planName,
      sessionId: session.id,
      subscriptionFromSession: session.subscription
    });
    
    try {
      const { Tenant } = await import('../models/Tenant.js');
      const tenant = await Tenant.findByPk(tenantId);
      
      if (!tenant) {
        console.error(`❌ [Stripe Webhook] Tenant ${tenantId} not found for SaaS subscription`);
        return res.status(200).json({ received: true, error: 'Tenant not found' });
      }
      
      // Obtener subscription ID del session
      let subscriptionId = session.subscription;
      
      // Si no está en session, obtener la sesión completa de Stripe
      if (!subscriptionId) {
        console.log('⚠️ [Stripe Webhook] No subscription in session, retrieving full session...');
        const fullSession = await stripe.checkout.sessions.retrieve(session.id, {
          expand: ['subscription']
        });
        subscriptionId = fullSession.subscription?.id || fullSession.subscription;
      }
      
      if (!subscriptionId) {
        console.error('❌ [Stripe Webhook] No subscription ID found after retrieval');
        return res.status(200).json({ received: true, error: 'No subscription ID' });
      }
      
      console.log('📝 [Stripe Webhook] Subscription ID obtained:', subscriptionId);
      
      // Actualizar tenant con subscripción activa
      await tenant.update({
        status: 'active',
        plan: session.metadata.planName || 'paid',
        stripe_subscription_id: subscriptionId,
        subscribed_at: new Date()
      });
      
      console.log('✅ [Stripe Webhook] Tenant subscription activated:', {
        tenantId: tenant.id,
        email: tenant.email,
        plan: tenant.plan,
        subscriptionId,
        status: 'active'
      });
      
      // 📧 Enviar email de pago exitoso
      sendPaymentSuccessEmail(tenant.id, {
        amount: (session.amount_total / 100).toFixed(2)
      }).catch(err => {
        console.error('⚠️ Error enviando payment success email:', err);
      });
      
      await webhookLog.markAsSuccess('SaaS subscription activated');
      
      return res.status(200).json({ 
        received: true, 
        type: 'saas_subscription',
        tenantId: tenant.id,
        subscriptionId
      });
      
    } catch (error) {
      console.error('❌ [Stripe Webhook] Error handling SaaS subscription:', error);
      await webhookLog.markAsFailed(`SaaS subscription error: ${error.message}`);
      return res.status(200).json({ received: true, error: error.message });
    }
  }
  
  // 🆕 Detectar si es compra de módulo
  const moduleId = session.metadata.moduleId ? Number(session.metadata.moduleId) : null;
  const moduleKey = session.metadata.moduleKey || null;
  const isModulePurchase = !!moduleId;

  console.log('[Stripe Webhook] Purchase type:', isModulePurchase ? `MODULE (${moduleKey})` : 'PRINTFUL');

  try {
    // 🔒 Generar token único para tracking público
    const trackingToken = crypto.randomBytes(16).toString('hex'); // 32 caracteres

    // Extraer country/locale desde metadata de Stripe o usar default
    const country = session.metadata.country || 'es';
    const locale = session.metadata.locale || 'es';

    // Crear venta con ID amigable
    const sale = await Sale.create({
      userId,
      guestId,
      currency_payment: session.currency,
      method_payment: 'STRIPE',
      n_transaction: 'temp', // Se actualizará después de obtener el ID
      stripeSessionId: session.id,
      total: (session.amount_total ?? 0) / 100,
      trackingToken, // 🔒 Token de seguridad para tracking
      country, // 🌍 País de contexto
      locale,  // 🌍 Idioma de contexto
    });

    // Actualizar n_transaction con formato amigable: sale_{id}_{timestamp}
    const friendlyTransactionId = `sale_${sale.id}_${Date.now()}`;
    await sale.update({ n_transaction: friendlyTransactionId });
    
    // 🆕 Si es compra de módulo, crear venta simple y retornar
    if (isModulePurchase) {
      console.log('[Stripe Webhook] Processing MODULE purchase:', { moduleId, moduleKey });
      console.log('[Stripe Webhook] session.metadata:', session.metadata);
      
      // Actualizar sale con module_id
      await sale.update({ module_id: moduleId });
      
      // 🆕 Crear SaleAddress para módulos (NECESARIO PARA EMAIL)
      console.log('[Stripe Webhook] Creating SaleAddress for module...');
      
      // Intentar obtener address desde CheckoutCache primero
      let moduleAddress = null;
      const cartIdFromMetadata = session.metadata?.cartId;
      
      if (cartIdFromMetadata) {
        try {
          const cacheRow = await CheckoutCache.findByPk(Number(cartIdFromMetadata));
          if (cacheRow && cacheRow.cart) {
            const parsedCache = JSON.parse(cacheRow.cart || 'null');
            if (parsedCache && parsedCache.address) {
              moduleAddress = parsedCache.address;
              console.log('[Stripe Webhook] Found address in CheckoutCache:', moduleAddress);
            }
          }
        } catch (err) {
          console.warn('[Stripe Webhook] Error reading address from CheckoutCache:', err.message);
        }
      }
      
      // Si no hay address en cache, crear una mínima con el email de metadata
      const emailFromMetadata = session.metadata?.email || session.customer_email || null;
      
      if (!moduleAddress && emailFromMetadata) {
        console.log('[Stripe Webhook] No address in cache, using email from metadata:', emailFromMetadata);
        moduleAddress = {
          name: 'Cliente',
          email: emailFromMetadata,
          pais: country || 'ES',
          address: 'Producto Digital',
          ciudad: '',
          region: '',
          telefono: '',
          zipcode: ''
        };
      }
      
      if (moduleAddress && moduleAddress.email) {
        const saleAddressPayload = {
          saleId: sale.id,
          name: moduleAddress.name || 'Cliente',
          surname: moduleAddress.surname || '',
          pais: moduleAddress.pais || country || 'ES',
          address: moduleAddress.address || 'Producto Digital',
          referencia: moduleAddress.referencia || '',
          ciudad: moduleAddress.ciudad || '',
          region: moduleAddress.region || '',
          telefono: moduleAddress.telefono || '',
          email: moduleAddress.email,
          nota: moduleAddress.nota || 'Compra de módulo digital',
          zipcode: moduleAddress.zipcode || ''
        };
        
        await SaleAddress.create(saleAddressPayload);
        console.log('✅ [Stripe Webhook] SaleAddress created with email:', moduleAddress.email);
      } else {
        console.error('❌ [Stripe Webhook] No email available to create SaleAddress!');
        console.error('❌ [Stripe Webhook] session.metadata.email:', session.metadata?.email);
        console.error('❌ [Stripe Webhook] session.customer_email:', session.customer_email);
      }
      
      // Crear SaleDetail simple para el módulo
      const { Module } = await import('../models/Module.js');
      const module = await Module.findByPk(moduleId);
      
      if (module) {
        await SaleDetail.create({
          saleId: sale.id,
          productId: null, // No hay producto físico
          variedadId: null,
          module_id: moduleId, // 🆕 Añadir module_id
          cantidad: 1,
          price_unitario: module.base_price,
          subtotal: module.base_price,
          total: module.base_price,
          discount: 0,
          type_discount: 1
        });
        
        console.log('[Stripe Webhook] MODULE sale created successfully:', sale.id);
        
        // 🆕 Auto-actualizar syncStatus según tipo de módulo
        if (module.type === 'digital' || module.type === 'service') {
          await sale.update({ syncStatus: 'fulfilled' });
          console.log('[Stripe Webhook] ✅ syncStatus set to fulfilled for digital/service module');
        } else if (module.type === 'physical') {
          // Productos físicos mantienen pending hasta fulfillment
          console.log('[Stripe Webhook] 📦 syncStatus remains pending for physical module');
        }
        
        // 📊 Incrementar estadísticas del módulo
        await module.increment({
          total_sales: 1,
          total_revenue: module.base_price,
          total_orders: 1
        });
        await module.update({ last_sale_at: new Date() });
        console.log('[Stripe Webhook] 📊 Module stats updated:', {
          total_sales: module.total_sales + 1,
          total_revenue: parseFloat(module.total_revenue) + module.base_price
        });
        
        // � AUTO-VALIDACIÓN: Si alcanzó el target, pasar de Testing → Live
        await module.reload();
        if (module.status === 'testing' && module.total_sales >= module.validation_target_sales) {
          await module.update({
            status: 'live',
            validated_at: new Date()
          });
          console.log('[Stripe Webhook] 🎉 MODULE AUTO-VALIDATED! Transitioned from testing → live:', {
            module_id: module.id,
            module_key: module.key,
            total_sales: module.total_sales,
            validation_target: module.validation_target_sales
          });
        }
        
        // �🆕 Enviar email de confirmación para módulos
        try {
          console.log('📧 [Stripe Webhook] Attempting to send email for module purchase...');
          await sendEmail(sale.id);
          console.log('✅ [Stripe Webhook] Confirmation email sent for module purchase');
        } catch (emailErr) {
          console.error('❌ [Stripe Webhook] Error sending confirmation email:', emailErr);
          console.error('❌ [Stripe Webhook] Error stack:', emailErr.stack);
        }
        
        return res.json({ received: true, saleId: sale.id, type: 'module' });
      } else {
        console.error('[Stripe Webhook] Module not found:', moduleId);
        return res.status(404).json({ error: 'Module not found' });
      }
    }
    
    // 🔹 A partir de aquí: lógica Printful (no modificada)

    // Crear detalles del carrito
    let cartItems = [];
    const cartIdFromMetadata = session.metadata?.cartId || session.metadata?.cart_id || session.metadata?.cartid || null;
    let checkoutCacheId = null;
    let checkoutCacheRowFound = false;
    let printfulCreated = false;

    if (cartIdFromMetadata) {
      try {
        console.log('[Stripe Webhook] Found cartId in metadata:', cartIdFromMetadata);
        const cacheRow = await CheckoutCache.findByPk(Number(cartIdFromMetadata));
        if (cacheRow && cacheRow.cart) {
          const parsedCache = JSON.parse(cacheRow.cart || 'null');
          if (Array.isArray(parsedCache)) {
            cartItems = parsedCache;
          } else if (parsedCache && Array.isArray(parsedCache.items)) {
            cartItems = parsedCache.items;
            req._stripe_cached_address = parsedCache.address || null;
          } else {
            cartItems = [];
          }
          checkoutCacheId = cacheRow.id;
          checkoutCacheRowFound = true;
          console.log('[Stripe Webhook] Loaded cart from CheckoutCache id=', cacheRow.id, 'items=', Array.isArray(cartItems) ? cartItems.length : 0);
        } else {
          console.warn('[Stripe Webhook] No CheckoutCache row found for id=', cartIdFromMetadata);
        }
      } catch (cacheErr) {
        console.warn('[Stripe Webhook] Error reading CheckoutCache id=', cartIdFromMetadata, cacheErr);
        cartItems = [];
      }
    }

    // Fallback to metadata.cart
    if ((!Array.isArray(cartItems) || cartItems.length === 0) && session.metadata?.cart) {
      try {
        cartItems = JSON.parse(session.metadata.cart || '[]');
        console.log('[Stripe Webhook] Loaded cart from metadata.cart length=', Array.isArray(cartItems) ? cartItems.length : 0);
      } catch (e) {
        console.warn('[Stripe Webhook] metadata.cart JSON parse failed, will fallback to DB carts:', e);
        cartItems = [];
      }
    }

    console.log('[Stripe Webhook] cartItems from metadata/checkoutCache length=', Array.isArray(cartItems) ? cartItems.length : 0);

    let sourceCarts = [];
    let sourceIsCache = false;
    if (!Array.isArray(cartItems) || cartItems.length === 0) {
      console.log('[Stripe Webhook] No cart items in metadata, loading from DB for userId/guestId', { userId, guestId });
      if (userId) {
        const carts = await Cart.findAll({ where: { userId } });
        sourceCarts = carts;
        sourceIsCache = false;
        cartItems = carts.map(c => ({
          id: c.id,
          productId: c.productId,
          variedadId: c.variedadId,
          cantidad: c.cantidad,
          price_unitario: c.price_unitario,
          discount: c.discount,
          type_discount: c.type_discount,
          code_cupon: c.code_cupon,
          code_discount: c.code_discount  // ADD: preserve Flash Sale IDs from DB
        }));
        console.log('[Stripe Webhook] Loaded carts from DB for userId=', userId, 'count=', carts.length);
      } else if (guestId) {
        const cartsCache = await CartCache.findAll({ where: { guest_id: guestId } });
        sourceCarts = cartsCache;
        sourceIsCache = true;
        cartItems = cartsCache.map(c => ({
          id: c.id,
          productId: c.productId,
          variedadId: c.variedadId,
          cantidad: c.cantidad,
          price_unitario: c.price_unitario,
          discount: c.discount,
          type_discount: c.type_discount,
          code_cupon: c.code_cupon,
          code_discount: c.code_discount  // ADD: preserve Flash Sale IDs from CartCache
        }));
        console.log('[Stripe Webhook] Loaded carts from CartCache for guestId=', guestId, 'count=', cartsCache.length);
      }
    }

    console.log('[Stripe Webhook] Final cartItems to persist count=', Array.isArray(cartItems) ? cartItems.length : 0, 'sourceIsCache=', sourceIsCache);

    // Create SaleDetails
    let createdDetailsCount = 0;
    const expectedCount = Array.isArray(cartItems) ? cartItems.length : 0;
    
    console.log(`[Stripe Webhook] 📦 Iniciando creación de ${expectedCount} SaleDetails para saleId=${sale.id}`);
    
    for (const [index, item] of cartItems.entries()) {
      try {
        console.log(`[Stripe Webhook] 📦 Processing item ${index + 1}/${expectedCount}:`, {
          productId: item.productId,
          variedadId: item.variedadId,
          cantidad: item.cantidad,
          price_unitario: item.price_unitario
        });

        // === VALIDACIÓN ESTRICTA DE DESCUENTO REAL ===
        let type_campaign = null;
        let discount = 0;
        let type_discount = item.type_discount || 1;
        let code_cupon = item.code_cupon || null;
        let code_discount = item.code_discount || null;

        // Importar modelos dinámicamente para evitar ciclos
        const { Discount } = await import('../models/Discount.js');
        const { DiscountProduct } = await import('../models/DiscountProduct.js');
        const { DiscountCategorie } = await import('../models/DiscountCategorie.js');
        const { Cupone } = await import('../models/Cupone.js');
        const { Product } = await import('../models/Product.js');

        // Resolver productId y categoryId
        let resolvedProductId = item.productId || null;
        let resolvedCategoryId = null;
        if (!resolvedProductId && item.variedadId) {
          try {
            const variedadRow = await Variedad.findByPk(item.variedadId);
            if (variedadRow && variedadRow.productId) {
              resolvedProductId = variedadRow.productId;
            }
          } catch {}
        }
        if (resolvedProductId) {
          try {
            const productRow = await Product.findByPk(resolvedProductId);
            if (productRow && productRow.categoryId) {
              resolvedCategoryId = productRow.categoryId;
            }
          } catch {}
        }

        // === VALIDAR CUPONES (type_campaign = 3) ===
        let cuponRow = null;
        let cuponValid = false;
        if (code_cupon) {
          try {
            // Buscar cupón en tabla cupones por código
            cuponRow = await Cupone.findOne({ where: { code: code_cupon, state: 1 } });
            
            if (cuponRow) {
              // Verificar si el cupón aplica al producto o categoría
              const { CuponeProduct } = await import('../models/CuponeProduct.js');
              const { CuponeCategorie } = await import('../models/CuponeCategorie.js');
              
              // Si type_segment = 1, el cupón aplica a productos específicos
              if (cuponRow.type_segment === 1 && resolvedProductId) {
                const cuponProduct = await CuponeProduct.findOne({
                  where: { cuponeId: cuponRow.id, productId: resolvedProductId }
                });
                cuponValid = !!cuponProduct;
              }
              // Si type_segment = 2, el cupón aplica a categorías específicas
              else if (cuponRow.type_segment === 2 && resolvedCategoryId) {
                const cuponCategorie = await CuponeCategorie.findOne({
                  where: { cuponeId: cuponRow.id, categoryId: resolvedCategoryId }
                });
                cuponValid = !!cuponCategorie;
              }
              // Si type_segment = 3, el cupón aplica a todos
              else if (cuponRow.type_segment === 3) {
                cuponValid = true;
              }
            }
          } catch (err) {
            console.warn('[Stripe] Error validando cupón:', err);
          }
        }

        // === VALIDAR CAMPAIGN DISCOUNT / FLASH SALE (type_campaign = 1 o 2) ===
        let discountRow = null;
        let discountValid = false;
        if (code_discount) {
          discountRow = await Discount.findByPk(code_discount);
          
          if (discountRow && discountRow.state === 1) {
            // Campaign Discount (type_campaign = 1): validar por producto O categoría
            if (discountRow.type_campaign === 1) {
              if (resolvedProductId) {
                const productDiscount = await DiscountProduct.findOne({ 
                  where: { discountId: code_discount, productId: resolvedProductId } 
                });
                if (productDiscount) discountValid = true;
              }
              if (!discountValid && resolvedCategoryId) {
                const categoryDiscount = await DiscountCategorie.findOne({ 
                  where: { discountId: code_discount, categoryId: resolvedCategoryId } 
                });
                if (categoryDiscount) discountValid = true;
              }
            }
            // Flash Sale (type_campaign = 2): validar SOLO por producto
            else if (discountRow.type_campaign === 2 && resolvedProductId) {
              const productDiscount = await DiscountProduct.findOne({ 
                where: { discountId: code_discount, productId: resolvedProductId } 
              });
              discountValid = !!productDiscount;
            }
          }
        }

        // === ASIGNAR VALORES SEGÚN VALIDACIÓN ===
        if (cuponValid && cuponRow) {
          // Cupón válido
          type_campaign = 3;
          discount = cuponRow.discount;
          type_discount = cuponRow.type_discount;
        } else if (discountValid && discountRow) {
          // Campaign Discount o Flash Sale válido
          type_campaign = discountRow.type_campaign;
          discount = discountRow.discount;
          type_discount = discountRow.type_discount;
        } else {
          // NO hay descuento real
          type_campaign = null;
          discount = 0;
          code_cupon = null;
          code_discount = null;
        }

        console.log(`[Stripe Webhook] ✅ Validación de descuento:`, {
          hasRealDiscount: type_campaign !== null,
          type_campaign,
          discount,
          code_cupon,
          code_discount,
          productId: resolvedProductId,
          categoryId: resolvedCategoryId
        });

        // 🔧 USAR finalPrice si llega del frontend con descuento aplicado
        let price_unitario;
        if (item.finalPrice != null) {
          price_unitario = Number(item.finalPrice);
        } else {
          const rawPrice = item.price_unitario != null ? Number(item.price_unitario) : 
                          (item.price != null ? Number(item.price) : 0);
          price_unitario = formatPrice(rawPrice);
          console.log(`[Stripe Webhook] ⚠️ finalPrice not received, using price_unitario with standard formatting: ${rawPrice} -> ${price_unitario}`);
        }
        
        const cantidad = item.cantidad != null ? Number(item.cantidad) : 1;

        // Total = precio unitario * cantidad (SIN redondeo adicional)
        const subtotal = parseFloat((price_unitario * cantidad).toFixed(2));
        const total = parseFloat((price_unitario * cantidad).toFixed(2));

        const detailPayload = {
          saleId: sale.id,
          productId: resolvedProductId,
          variedadId: item.variedadId || null,
          cantidad: cantidad,
          price_unitario: price_unitario,
          discount: discount,
          type_discount: type_discount,
          code_cupon: code_cupon,
          code_discount: code_discount,
          type_campaign: type_campaign,
          subtotal: subtotal,
          total: total,
        };

        console.log('[Stripe Webhook] 📦 Creating SaleDetail:', {
          saleId: sale.id,
          productId: resolvedProductId,
          type_campaign,
          discount,
          price_unitario,
          total
        });

        const createdDetail = await SaleDetail.create(detailPayload);
        createdDetailsCount++;
        console.log(`[Stripe Webhook] ✅ SaleDetail ${createdDetailsCount}/${expectedCount} creado exitosamente:`, {
          saleDetailId: createdDetail.id,
          saleId: sale.id, 
          productId: detailPayload.productId, 
          variedadId: detailPayload.variedadId,
          cantidad: detailPayload.cantidad,
          total: detailPayload.total
        });
      } catch (detailErr) {
        console.error(`[Stripe Webhook] ❌ ERROR creando SaleDetail ${index + 1}/${expectedCount} para saleId=${sale.id}:`);
        console.error('[Stripe Webhook] Item que falló:', item);
        console.error('[Stripe Webhook] Error details:', detailErr && (detailErr.stack || detailErr.message || detailErr));
        
        // Este error es crítico - no continuar con la limpieza
        console.error(`[Stripe Webhook] ❌ CRÍTICO: Falló creación de SaleDetail, NO se limpiará el carrito`);
      }
    }

    

    // Verificar que se crearon TODOS los SaleDetails esperados
    const saleDetailsCreationSuccess = (expectedCount > 0 && createdDetailsCount === expectedCount);
    

    if (!saleDetailsCreationSuccess) {
      
      return res.status(500).json({ 
        received: false, 
        error: 'SaleDetails creation failed',
        expected: expectedCount,
        created: createdDetailsCount
      });
    }

    // Decrementar cupones solo si todos los SaleDetails se crearon exitosamente
    
    await decrementCouponUsageForStripe(cartItems);

    // === Printful + email flow ===
    try {
      // Re-read cache for address
      let saleAddressFromCache = null;
      if (checkoutCacheRowFound && checkoutCacheId) {
        try {
          const cacheRow = await CheckoutCache.findByPk(checkoutCacheId);
          if (cacheRow && cacheRow.cart) {
            const parsed = JSON.parse(cacheRow.cart || '{}');
            if (parsed && parsed.address) saleAddressFromCache = parsed.address;
          }
        } catch (e) {
          console.warn('[Stripe Webhook] Could not parse CheckoutCache for address id=', checkoutCacheId, e && e.message);
        }
      }

      if (!saleAddressFromCache && req && req._stripe_cached_address) {
        saleAddressFromCache = req._stripe_cached_address;
      }

      // Crear recibo (Receipt) asociado a la venta ===
      try {
        await createSaleReceipt(sale, 'STRIPE', { sessionId: session.id }, saleAddressFromCache);
      } catch (receiptErr) {
        console.error('[Stripe Webhook] Error creando Receipt para saleId=', sale.id, receiptErr && (receiptErr.message || receiptErr));
      }

      const emailFromMetadata = session.metadata?.email || '';
      if ((saleAddressFromCache || emailFromMetadata) && Array.isArray(cartItems) && cartItems.length > 0) {
        console.log('[Stripe Webhook] Preparing Printful payload; address present?', !!saleAddressFromCache, 'emailFromMetadata=', !!emailFromMetadata);

        const pfItems = [];
        let subtotal = 0;
        for (const it of cartItems) {
          const cantidad = it.cantidad != null ? Number(it.cantidad) : 1;
          // 🔥 USAR finalPrice si existe (con descuento aplicado), sino price_unitario original
          const price_unitario = it.finalPrice != null ? Number(it.finalPrice) : (it.price_unitario != null ? Number(it.price_unitario) : (it.price != null ? Number(it.price) : 0));
          console.log('[Stripe Webhook] Item pricing:', { 
            finalPrice: it.finalPrice, 
            price_unitario: it.price_unitario, 
            used: price_unitario,
            hasDiscount: it.hasDiscount,
            discount: it.discount
          });
          subtotal += price_unitario * cantidad;

          let variant_id = null;
          try {
            if (it.variedadId) {
              const v = await Variedad.findByPk(it.variedadId);
              if (v && v.variant_id) variant_id = Number(v.variant_id);
            }
          } catch (e) {
            console.warn('[Stripe Webhook] Error resolving variant_id for variedadId=', it.variedadId, e && e.message);
          }

          let files = [];
          try {
            if (it.variedadId) {
              const fileRows = await File.findAll({ where: { varietyId: it.variedadId } });
              if (Array.isArray(fileRows) && fileRows.length > 0) {
                files = fileRows.map(f => ({ url: f.preview_url || f.thumbnail_url || f.url || '', type: f.type || 'default', filename: f.filename || '' })).filter(f => f.url);
              }
            }
          } catch (e) {
            console.warn('[Stripe Webhook] Error fetching files for variedadId=', it.variedadId, e && e.message);
          }

          // Build options for the item (needed for embroidered caps: thread colors, stitch color, etc.)
          let itemOptions = {};
          try {
            if (it.variedadId) {
              const optionRows = await Option.findAll({ where: { varietyId: it.variedadId } });
              if (Array.isArray(optionRows) && optionRows.length > 0) {
                for (const opt of optionRows) {
                  const idKey = opt.idOption || opt.id || opt.name || null;
                  if (!idKey) continue;
                  let parsedVal = null;
                  try {
                    parsedVal = JSON.parse(opt.value);
                  } catch (pe) {
                    parsedVal = opt.value;
                  }
                  // normalize arrays
                  if (Array.isArray(parsedVal)) {
                    parsedVal = parsedVal.length > 0 ? parsedVal : parsedVal;
                  }

                  if (typeof idKey === 'string' && idKey.startsWith('thread_colors')) {
                    const vals = Array.isArray(parsedVal) ? parsedVal : [parsedVal];
                    const allowed = ['#FFFFFF','#000000','#96A1A8','#A67843','#FFCC00','#E25C27','#CC3366','#CC3333','#660000','#333366','#005397','#3399FF','#6B5294','#01784E','#7BA35A'];
                    const filtered = vals.filter(v => typeof v === 'string' && allowed.includes(v));
                    if (filtered.length > 0) {
                      itemOptions[idKey] = filtered;
                    } else {
                      itemOptions[idKey] = [allowed[0]];
                    }
                  } else if (idKey === 'stitch_color') {
                    const v = (parsedVal && typeof parsedVal === 'string') ? parsedVal : (Array.isArray(parsedVal) ? parsedVal[0] : null);
                    itemOptions[idKey] = (v === 'black' ? 'black' : 'white');
                  } else {
                    itemOptions[idKey] = parsedVal;
                  }
                }
              }
            }
          } catch (optErr) {
            console.warn('[Stripe Webhook] Error fetching options for variedadId=', it.variedadId, optErr && optErr.message);
          }

          let name = it.title || '';
          try {
            if (!name && it.productId) {
              const prod = await (await import('../models/Product.js')).Product.findByPk(it.productId).catch(() => null);
              if (prod && prod.title) name = prod.title;
            }
          } catch (e) { /* ignore */ }

          const itemPayload = { variant_id: variant_id, quantity: cantidad, name: name || '', price: String(price_unitario), retail_price: String(price_unitario), files };
          if (itemOptions && Object.keys(itemOptions).length > 0) itemPayload.options = itemOptions;
          pfItems.push(itemPayload);
        }

        const recipient = {
          name: (saleAddressFromCache && (saleAddressFromCache.name || saleAddressFromCache.fullname)) || '',
          address1: (saleAddressFromCache && (saleAddressFromCache.address || saleAddressFromCache.address1)) || '',
          city: (saleAddressFromCache && (saleAddressFromCache.ciudad || saleAddressFromCache.city)) || '',
          state_code: (saleAddressFromCache && (saleAddressFromCache.region || saleAddressFromCache.state)) || '',
          country_code: (saleAddressFromCache && (saleAddressFromCache.pais || saleAddressFromCache.country)) || 'ES',
          zip: (saleAddressFromCache && (saleAddressFromCache.zipcode || saleAddressFromCache.zip)) || '',
          phone: (saleAddressFromCache && (saleAddressFromCache.telefono || saleAddressFromCache.phone)) || '',
          email: (saleAddressFromCache && saleAddressFromCache.email) || emailFromMetadata || ''
        };

        // Feature flag para auto-confirm de órdenes de Printful
        const AUTO_CONFIRM = process.env.PRINTFUL_AUTO_CONFIRM === 'true';

        const pfOrder = {
          recipient,
          items: pfItems,
          retail_costs: { subtotal: subtotal.toFixed(2), discount: '0.00', shipping: '0.00', tax: '0.00' },
          external_id: `sale_${sale.id}_${Date.now()}`,
          shipping: 'STANDARD',
          confirm: AUTO_CONFIRM
        };

        // 🔹 Console log para depuración
        console.log('[Stripe Webhook] pfOrder payload to send to Printful:', JSON.stringify(pfOrder, null, 2));
        console.log(`[Stripe Webhook] Printful auto-confirm: ${AUTO_CONFIRM}`);

        // Persist recipient email to Guest/User if present
        try {
          const resolvedEmail = (recipient && recipient.email) ? String(recipient.email).trim() : '';
          if (resolvedEmail) {
            if (guestId) {
              try {
                const guestRow = await Guest.findByPk(guestId);
                if (guestRow && (!guestRow.email || guestRow.email.trim() === '')) {
                  await guestRow.update({ email: resolvedEmail });
                  console.log('[Stripe Webhook] Updated Guest.email from metadata for guestId=', guestId);
                }
              } catch (gErr) {
                console.warn('[Stripe Webhook] Could not update Guest email for guestId=', guestId, gErr && gErr.message);
              }
            }
            if (userId) {
              try {
                const userRow = await User.findByPk(userId);
                if (userRow && (!userRow.email || userRow.email.trim() === '')) {
                  await userRow.update({ email: resolvedEmail });
                  console.log('[Stripe Webhook] Updated User.email from metadata for userId=', userId);
                }
              } catch (uErr) {
                console.warn('[Stripe Webhook] Could not update User email for userId=', userId, uErr && uErr.message);
              }
            }
          }
        } catch (persistErr) {
          console.warn('[Stripe Webhook] Error persisting resolved email to Guest/User:', persistErr && persistErr.message);
        }

        // Persist SaleAddress if we have cached address and none exists
        try {
          if (saleAddressFromCache) {
            const existingAddr = await SaleAddress.findOne({ where: { saleId: sale.id } });
            if (!existingAddr) {
              const addrPayload = {
                saleId: sale.id,
                name: saleAddressFromCache.name || saleAddressFromCache.fullname || '',
                surname: saleAddressFromCache.surname || '',
                pais: saleAddressFromCache.pais || saleAddressFromCache.country || '',
                address: saleAddressFromCache.address || saleAddressFromCache.address1 || '',
                referencia: saleAddressFromCache.referencia || '',
                ciudad: saleAddressFromCache.ciudad || saleAddressFromCache.city || '',
                region: saleAddressFromCache.region || saleAddressFromCache.state || saleAddressFromCache.poblacion || '',
                telefono: saleAddressFromCache.telefono || saleAddressFromCache.phone || '',
                email: saleAddressFromCache.email || emailFromMetadata || '',
                nota: saleAddressFromCache.nota || '',
                zipcode: saleAddressFromCache.zipcode || saleAddressFromCache.postalCode || ''
              };
              await SaleAddress.create(addrPayload);
              console.log('[Stripe Webhook] Created SaleAddress from cached address for saleId=', sale.id);
            } else {
              console.log('[Stripe Webhook] SaleAddress already exists for saleId=', sale.id);
            }
          }
        } catch (addrErr) {
          console.warn('[Stripe Webhook] Could not persist SaleAddress for saleId=', sale.id, addrErr && addrErr.message);
        }

        // Log payload and call Printful
        try {
          console.log('[Stripe Webhook] Printful order payload (recipient, first item):', {
            recipient: pfOrder.recipient,
            firstItem: pfOrder.items && pfOrder.items.length > 0 ? pfOrder.items[0] : null,
            itemsCount: Array.isArray(pfOrder.items) ? pfOrder.items.length : 0
          });

          const pfResult = await createPrintfulOrder(pfOrder);
          console.log('[Stripe Webhook] Full Printful raw result:', pfResult);

          const pfData = (pfResult && pfResult.data) ? pfResult.data : (pfResult && typeof pfResult === 'object' ? pfResult : null);
          if (pfData) {
            const printfulOrderId = pfData.orderId ?? (pfData.result && pfData.result.id) ?? null;
            const printfulStatus = pfData.raw?.status || (pfData.result && pfData.result.status) || 'unknown';
            await sale.update({ printfulOrderId, printfulStatus, printfulUpdatedAt: new Date() });
            printfulCreated = true;

            const pfDates = (pfData.result || pfData);
            if (pfDates && pfDates.minDeliveryDate) {
              const minD = new Date(pfDates.minDeliveryDate);
              if (!isNaN(minD.getTime())) {
                const maxD = new Date(minD);
                maxD.setDate(maxD.getDate() + 7);
                await sale.update({ minDeliveryDate: minD.toISOString().split('T')[0], maxDeliveryDate: maxD.toISOString().split('T')[0] });
              }
            }
          } else {
            console.warn('[Stripe Webhook] Printful returned no data for saleId=', sale.id, 'pfResult=', pfResult);
          }
        } catch (pfErr) {
          console.error('[Stripe Webhook] Error creating Printful order for saleId=', sale.id, pfErr && (pfErr.message || pfErr));
        }

        // Always attempt to send confirmation email
        try {
          console.log('[Stripe Webhook] Calling sendEmail for saleId=', sale.id);
          await sendEmail(sale.id);
          console.log('[Stripe Webhook] sendEmail finished for saleId=', sale.id);
        } catch (emailErr) {
          console.error('[Stripe Webhook] sendEmail error for saleId=', sale.id, emailErr && (emailErr.message || emailErr));
        }
      } else {
        console.log('[Stripe Webhook] No address/email available to create Printful order or send email for saleId=', sale.id);
      }
    } catch (pfFlowErr) {
      console.error('[Stripe Webhook] Error in Printful/email flow for saleId=', sale.id, pfFlowErr && (pfFlowErr.stack || pfFlowErr.message || pfFlowErr));
    }

    // === IMPORTANTE: Solo limpiar si TODOS los SaleDetails se crearon correctamente ===
    // Delete CheckoutCache if ALL sale details were created successfully
    try {
      if (checkoutCacheRowFound && checkoutCacheId && saleDetailsCreationSuccess) {
        await CheckoutCache.destroy({ where: { id: checkoutCacheId } });
        console.log(`[Stripe Webhook] ✅ Deleted CheckoutCache id=${checkoutCacheId} after successful sale processing`);
      } else if (checkoutCacheRowFound && checkoutCacheId) {
        console.log(`[Stripe Webhook] ⚠️ NOT deleting CheckoutCache id=${checkoutCacheId} - SaleDetails creation incomplete`);
      }
    } catch (delCacheErr) {
      console.warn('[Stripe Webhook] Failed to delete CheckoutCache id=', checkoutCacheId, delCacheErr && (delCacheErr.message || delCacheErr));
    }

    // === LIMPIEZA DE CARRITO: Solo si TODOS los SaleDetails se crearon correctamente ===
    if (saleDetailsCreationSuccess) {
      // Remove source carts after successful sale creation
      if (sourceCarts && sourceCarts.length > 0) {
        try {
          console.log(`[Stripe Webhook] 🧹 Limpiando ${sourceCarts.length} items del carrito después de venta exitosa`);
          for (const c of sourceCarts) {
            try {
              if (c && c.id) {
                if (sourceIsCache) {
                  await CartCache.destroy({ where: { id: c.id } });
                  console.log(`[Stripe Webhook] ✅ CartCache eliminado: ${c.id}`);
                } else {
                  await Cart.destroy({ where: { id: c.id } });
                  console.log(`[Stripe Webhook] ✅ Cart eliminado: ${c.id}`);
                }
              }
            } catch (delErr) {
              console.warn('[Stripe Webhook] No se pudo eliminar item de carrito fuente id=', c && c.id, delErr && (delErr.message || delErr));
            }
          }
          console.log(`[Stripe Webhook] 🎉 Carrito limpiado completamente después de pago Stripe`);
        } catch (delAllErr) {
          console.error('[Stripe Webhook] Error eliminando items de carrito fuente:', delAllErr && (delAllErr.stack || delAllErr.message || delAllErr));
        }
      }

      // Limpieza adicional: asegurar que todos los carritos del usuario/guest se limpien
      try {
        if (userId) {
          const remainingCarts = await Cart.destroy({ where: { userId } });
          if (remainingCarts > 0) {
            console.log(`[Stripe Webhook] 🧹 Limpieza adicional: eliminados ${remainingCarts} Cart items para userId=${userId}`);
          }
        }
        if (guestId) {
          const remainingCacheItems = await CartCache.destroy({ where: { guest_id: guestId } });
          if (remainingCacheItems > 0) {
            console.log(`[Stripe Webhook] 🧹 Limpieza adicional: eliminados ${remainingCacheItems} CartCache items para guestId=${guestId}`);
          }
        }
      } catch (cleanupErr) {
        console.warn('[Stripe Webhook] Error en limpieza adicional de carritos:', cleanupErr && (cleanupErr.message || cleanupErr));
      }
    } else {
      console.warn(`[Stripe Webhook] ⚠️ NO SE LIMPIA EL CARRITO - Los SaleDetails no se crearon correctamente`);
      console.warn(`[Stripe Webhook] ⚠️ Esto preserva los datos del carrito para que successfull-checkout funcione`);
    }

    console.log('[Stripe Webhook] Venta y detalles registrados correctamente, saleId=', sale.id);
  } catch (err) {
    console.error('[Stripe Webhook] Error registrando venta + detalles:', err && (err.stack || err.message || err));
  }

  res.json({ received: true });
}

/**
 * Decrementar el uso de cupones limitados para una venta de Stripe
 */
const decrementCouponUsageForStripe = async (cartItems) => {
    try {
        // Obtener cupones únicos de todos los items del carrito
        const uniqueCoupons = [...new Set(
            cartItems.filter(item => item.code_cupon)
                     .map(item => item.code_cupon)
        )];

        console.log(`🔍 [decrementCouponUsageForStripe] Items con cupón:`, 
            cartItems.filter(item => item.code_cupon).map(item => ({ 
                code_cupon: item.code_cupon, 
                discount: item.discount 
            }))
        );

        if (uniqueCoupons.length === 0) {
            console.log(`ℹ️ [decrementCouponUsageForStripe] No hay cupones para procesar`);
            return;
        }

        console.log(`🎟️ [decrementCouponUsageForStripe] Procesando ${uniqueCoupons.length} cupones únicos:`, uniqueCoupons);

        // Procesar cada cupón único una sola vez
        for (const couponCode of uniqueCoupons) {
            await decrementSingleCouponStripe(couponCode);
        }
        
    } catch (error) {
        console.error(`❌ [decrementCouponUsageForStripe] Error general:`, error);
    }
};

/**
 * Decrementar el uso de un cupón específico para Stripe
 */
const decrementSingleCouponStripe = async (couponCode) => {
    try {
        console.log(`🎟️ [decrementSingleCouponStripe] Procesando cupón: ${couponCode}`);

        // Buscar el cupón
        const cupon = await Cupone.findOne({
            where: { 
                code: couponCode,
                state: 1 // Solo cupones activos
            }
        });

        if (!cupon) {
            console.warn(`⚠️ [decrementSingleCouponStripe] Cupón no encontrado o inactivo: ${couponCode}`);
            return;
        }

        // Solo decrementar si es cupón limitado (type_count = 2)
        if (cupon.type_count === 2) {
            if (cupon.num_use && cupon.num_use > 0) {
                const newUsageCount = cupon.num_use - 1;
                
                await Cupone.update(
                    { num_use: newUsageCount },
                    { where: { id: cupon.id } }
                );

                console.log(`✅ [decrementSingleCouponStripe] Cupón ${cupon.code} decrementado: ${cupon.num_use} -> ${newUsageCount}`);
                
                // Si llega a 0, opcionalmente marcar como inactivo
                if (newUsageCount === 0) {
                    console.log(`🚫 [decrementSingleCouponStripe] Cupón ${cupon.code} agotado (0 usos restantes)`);
                }
            } else {
                console.warn(`⚠️ [decrementSingleCouponStripe] Cupón ${cupon.code} ya sin usos disponibles`);
            }
        } else {
            console.log(`ℹ️ [decrementSingleCouponStripe] Cupón ${cupon.code} es ilimitado, no se decrementa`);
        }
        
    } catch (error) {
        console.error(`❌ [decrementSingleCouponStripe] Error al decrementar cupón:`, error);
        // No lanzar error para no afectar la venta principal
    }
};

// ============================================================================
// 🆕 SaaS Subscription Webhooks
// ============================================================================

/**
 * Manejar evento invoice.paid
 * Se dispara cuando se paga una factura (renovación mensual de subscripción)
 */
async function handleInvoicePaid(event, res, webhookLog) {
  try {
    console.log('💳 [Stripe Webhook] Processing invoice.paid event');
    const invoice = event.data.object;
    
    // Solo procesar si es de una subscripción (no de checkout único)
    if (!invoice.subscription) {
      console.log('⚠️ [Stripe Webhook] Invoice no relacionado con subscripción, ignorando');
      return res.json({ received: true });
    }

    console.log('[Stripe Webhook] Invoice paid:', {
      id: invoice.id,
      subscription: invoice.subscription,
      customer: invoice.customer,
      amount_paid: invoice.amount_paid / 100
    });

    // Obtener la subscripción para acceder a metadata
    const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
    
    const tenantId = subscription.metadata.tenantId;
    const moduleKey = subscription.metadata.moduleKey;
    const planName = subscription.metadata.planName;

    if (!tenantId) {
      console.warn('⚠️ [Stripe Webhook] Invoice paid pero sin tenantId en metadata');
      return res.json({ received: true });
    }

    // Buscar tenant y actualizar
    const { Tenant } = await import('../models/Tenant.js');
    const tenant = await Tenant.findByPk(tenantId);

    if (!tenant) {
      console.error(`❌ [Stripe Webhook] Tenant ${tenantId} not found for invoice.paid`);
      return res.json({ received: true });
    }

    // Si es la primera renovación o necesita reactivarse
    if (tenant.status !== 'active') {
      console.log(`✅ [Stripe Webhook] Activando tenant ${tenant.email} tras pago de invoice`);
      
      await tenant.update({
        status: 'active',
        plan: planName || tenant.plan,
        stripe_subscription_id: subscription.id,
        stripe_price_id: subscription.items.data[0]?.price.id,
        subscribed_at: tenant.subscribed_at || new Date(),
        cancelled_at: null,
        subscription_ends_at: null
      });
      
      // 📧 Enviar email de pago exitoso en renovación
      sendPaymentSuccessEmail(tenant.id).catch(err => {
        console.error('⚠️ Error enviando payment success email:', err);
      });
    } else {
      console.log(`ℹ️ [Stripe Webhook] Tenant ${tenant.email} ya está activo, renovación procesada`);
    }

    console.log('✅ [Stripe Webhook] Invoice paid processed successfully');
    await webhookLog.markAsSuccess('Invoice paid processed');
    return res.json({ received: true });

  } catch (error) {
    console.error('❌ [Stripe Webhook] Error handling invoice.paid:', error);
    await webhookLog.markAsFailed(`invoice.paid error: ${error.message}`);
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Manejar evento customer.subscription.updated
 * Se dispara cuando se actualiza una subscripción (cambio de plan, cancelación, etc.)
 */
async function handleSubscriptionUpdated(event, res, webhookLog) {
  try {
    console.log('🔄 [Stripe Webhook] Processing customer.subscription.updated event');
    const subscription = event.data.object;

    console.log('[Stripe Webhook] Subscription updated:', {
      id: subscription.id,
      status: subscription.status,
      cancel_at_period_end: subscription.cancel_at_period_end,
      current_period_end: subscription.current_period_end
    });

    const tenantId = subscription.metadata.tenantId;
    
    if (!tenantId) {
      console.warn('⚠️ [Stripe Webhook] Subscription updated pero sin tenantId en metadata');
      return res.json({ received: true });
    }

    const { Tenant } = await import('../models/Tenant.js');
    const tenant = await Tenant.findByPk(tenantId);

    if (!tenant) {
      console.error(`❌ [Stripe Webhook] Tenant ${tenantId} not found for subscription.updated`);
      return res.json({ received: true });
    }

    // Si el usuario canceló (cancel_at_period_end = true)
    if (subscription.cancel_at_period_end) {
      const endDate = new Date(subscription.current_period_end * 1000);
      
      console.log(`⚠️ [Stripe Webhook] Tenant ${tenant.email} canceló suscripción (acceso hasta ${endDate.toISOString()})`);
      
      // ⚠️ NO cambiar status a "cancelled" - mantener "active" hasta que expire
      await tenant.update({
        cancelled_at: new Date(),
        subscription_ends_at: endDate
        // status se mantiene en "active" para que conserve acceso
      });
      
      // 📧 Enviar email de cancelación
      sendSubscriptionCancelledEmail(tenant.id).catch(err => {
        console.error('⚠️ Error enviando subscription cancelled email:', err);
      });
    } 
    // Si se reactivó una subscripción cancelada
    else if (tenant.status === 'cancelled' && !subscription.cancel_at_period_end) {
      console.log(`✅ [Stripe Webhook] Tenant ${tenant.email} reactivó subscripción`);
      
      await tenant.update({
        status: 'active',
        cancelled_at: null,
        subscription_ends_at: null
      });
    }

    console.log('✅ [Stripe Webhook] Subscription updated processed successfully');
    await webhookLog.markAsSuccess('Subscription updated processed');
    return res.json({ received: true });

  } catch (error) {
    console.error('❌ [Stripe Webhook] Error handling subscription.updated:', error);
    await webhookLog.markAsFailed(`subscription.updated error: ${error.message}`);
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Manejar evento customer.subscription.deleted
 * Se dispara cuando una subscripción es eliminada/expirada definitivamente
 */
async function handleSubscriptionDeleted(event, res, webhookLog) {
  try {
    console.log('🗑️ [Stripe Webhook] Processing customer.subscription.deleted event');
    const subscription = event.data.object;

    console.log('[Stripe Webhook] Subscription deleted:', {
      id: subscription.id,
      status: subscription.status
    });

    const tenantId = subscription.metadata.tenantId;
    
    if (!tenantId) {
      console.warn('⚠️ [Stripe Webhook] Subscription deleted pero sin tenantId en metadata');
      return res.json({ received: true });
    }

    const { Tenant } = await import('../models/Tenant.js');
    const tenant = await Tenant.findByPk(tenantId);

    if (!tenant) {
      console.error(`❌ [Stripe Webhook] Tenant ${tenantId} not found for subscription.deleted`);
      return res.json({ received: true });
    }

    console.log(`❌ [Stripe Webhook] Marcando tenant ${tenant.email} como expirado (subscripción eliminada)`);
    
    await tenant.update({
      status: 'expired',
      subscription_ends_at: new Date()
    });

    // 📧 Enviar email de acceso perdido
    sendAccessLostEmail(tenant.id).catch(err => {
      console.error('⚠️ Error enviando access lost email:', err);
    });

    console.log('✅ [Stripe Webhook] Subscription deleted processed successfully');
    await webhookLog.markAsSuccess('Subscription deleted processed');
    return res.json({ received: true });

  } catch (error) {
    console.error('❌ [Stripe Webhook] Error handling subscription.deleted:', error);
    await webhookLog.markAsFailed(`subscription.deleted error: ${error.message}`);
    return res.status(500).json({ error: error.message });
  }
}

// ============================================================================
// 🆕 SaaS Subscriptions
// ============================================================================

/**
 * POST /api/stripe/create-subscription-checkout
 * Crear sesión de Stripe Checkout para subscripciones recurrentes SaaS
 * 
 * Body: {
 *   tenantId: number,
 *   moduleKey: string,
 *   planName: string,
 *   stripePriceId: string,  // price_xxx de Stripe (debe existir en Stripe Dashboard)
 *   successUrl: string,
 *   cancelUrl: string
 * }
 */
export const createSubscriptionCheckout = async (req, res) => {
  try {
    const { tenantId, moduleKey, planName, stripePriceId, successUrl, cancelUrl } = req.body;

    console.log('🚀 [Stripe SaaS] Creating subscription checkout:');
    console.log('   📋 Tenant ID:', tenantId);
    console.log('   📦 Module:', moduleKey);
    console.log('   💎 Plan:', planName);
    console.log('   💳 Stripe Price ID:', stripePriceId);
    console.log('   📍 Success URL:', successUrl);
    console.log('   ❌ Cancel URL:', cancelUrl);

    // Validar campos requeridos
    if (!tenantId || !moduleKey || !planName || !stripePriceId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: tenantId, moduleKey, planName, stripePriceId'
      });
    }

    // Buscar tenant
    const { Tenant } = await import('../models/Tenant.js');
    const tenant = await Tenant.findByPk(tenantId);

    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant not found'
      });
    }

    // Validar que el tenant pertenezca al módulo
    if (tenant.module_key !== moduleKey) {
      return res.status(403).json({
        success: false,
        message: 'Tenant does not belong to this module'
      });
    }

    // Buscar o crear customer en Stripe
    let customerId = tenant.stripe_customer_id;

    if (!customerId) {
      console.log('📝 [Stripe SaaS] Creating new customer in Stripe...');
      
      const customer = await stripe.customers.create({
        email: tenant.email,
        name: tenant.name,
        metadata: {
          tenantId: tenant.id,
          moduleKey: tenant.module_key
        }
      });

      customerId = customer.id;
      
      // Guardar customer ID en el tenant
      await tenant.update({ stripe_customer_id: customerId });
      
      console.log('✅ [Stripe SaaS] Customer created:', customerId);
    }

    // Log detallado antes de crear la sesión
    console.log('🔵 [Stripe SaaS] Creating Stripe Checkout session with:');
    console.log('   👤 Customer:', customerId);
    console.log('   💳 Price ID:', stripePriceId);
    console.log('   📦 Plan Name:', planName);

    // Crear sesión de Checkout de Stripe con modo 'subscription'
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [
        {
          price: stripePriceId, // El price ID debe estar creado en Stripe Dashboard
          quantity: 1
        }
      ],
      success_url: successUrl || `${process.env.URL_FRONTEND}/upgrade/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${process.env.URL_FRONTEND}/upgrade?canceled=true`,
      metadata: {
        tenantId: tenant.id,
        moduleKey: tenant.module_key,
        planName: planName,
        type: 'saas_subscription'
      },
      subscription_data: {
        metadata: {
          tenantId: tenant.id,
          moduleKey: tenant.module_key,
          planName: planName
        }
      }
    });

    console.log('✅ [Stripe SaaS] Checkout session created:', session.id);

    res.json({
      success: true,
      sessionId: session.id,
      url: session.url
    });

  } catch (error) {
    console.error('❌ [Stripe SaaS] Error creating subscription checkout:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating checkout session',
      error: error.message
    });
  }
};

/**
 * POST /api/stripe/cancel-subscription
 * Cancelar suscripción de un tenant
 * 
 * Body: {
 *   tenantId: number,
 *   reason?: string  // Motivo de cancelación (opcional)
 * }
 */
export const cancelSubscription = async (req, res) => {
  try {
    const { tenantId, reason } = req.body;

    console.log('🚫 [Stripe SaaS] Canceling subscription:', {
      tenantId,
      reason: reason || 'No reason provided'
    });

    // Validar campos requeridos
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: tenantId'
      });
    }

    // Buscar tenant
    const { Tenant } = await import('../models/Tenant.js');
    const tenant = await Tenant.findByPk(tenantId);

    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant not found'
      });
    }

    // Verificar que tenga suscripción activa
    if (!tenant.stripe_subscription_id) {
      return res.status(400).json({
        success: false,
        message: 'No active subscription found'
      });
    }

    console.log('📋 [Stripe SaaS] Subscription to cancel:', tenant.stripe_subscription_id);

    // Cancelar en Stripe (al final del período)
    const subscription = await stripe.subscriptions.update(
      tenant.stripe_subscription_id,
      {
        cancel_at_period_end: true,
        metadata: {
          cancellation_reason: reason || 'User requested',
          cancelled_at: new Date().toISOString()
        }
      }
    );

    // Actualizar tenant con fecha de cancelación
    await tenant.update({
      cancelled_at: new Date(),
      subscription_ends_at: new Date(subscription.current_period_end * 1000)
    });

    console.log('✅ [Stripe SaaS] Subscription will cancel at:', new Date(subscription.current_period_end * 1000));

    res.json({
      success: true,
      message: 'Subscription will be cancelled at the end of the billing period',
      endsAt: new Date(subscription.current_period_end * 1000)
    });

  } catch (error) {
    console.error('❌ [Stripe SaaS] Error canceling subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Error canceling subscription',
      error: error.message
    });
  }
};

// Reactivar suscripción
export const reactivateSubscription = async (req, res) => {
  try {
    const { tenantId } = req.body;
    const userId = req.tenant?.id;

    console.log('🔄 [Stripe SaaS] Reactivating subscription for tenant:', tenantId || userId);

    const tenant = await Tenant.findByPk(tenantId || userId);

    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant not found'
      });
    }

    if (!tenant.stripe_subscription_id) {
      return res.status(400).json({
        success: false,
        message: 'No active subscription found'
      });
    }

    // Reactivar suscripción en Stripe eliminando cancel_at_period_end
    const subscription = await stripe.subscriptions.update(
      tenant.stripe_subscription_id,
      {
        cancel_at_period_end: false
      }
    );

    console.log('✅ [Stripe SaaS] Subscription reactivated in Stripe:', subscription.id);

    // Limpiar campos de cancelación en la base de datos
    await tenant.update({
      cancelled_at: null,
      subscription_ends_at: null
    });

    console.log('✅ [Stripe SaaS] Subscription reactivated in database for:', tenant.email);

    res.json({
      success: true,
      message: 'Subscription reactivated successfully'
    });

  } catch (error) {
    console.error('❌ [Stripe SaaS] Error reactivating subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Error reactivating subscription',
      error: error.message
    });
  }
};


