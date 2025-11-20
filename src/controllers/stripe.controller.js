import { Op, Sequelize } from 'sequelize';
import Stripe from 'stripe';
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

import { createPrintfulOrder } from './proveedor/printful/productPrintful.controller.js';
import { createSaleReceipt } from './helpers/receipt.helper.js';
import { sendEmail } from './sale.controller.js';

import stripe from '../devtools/utils/stripe.js';

// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
//   apiVersion: '2023-10-16', // o la que uses
// });

/**
 * POST /api/stripe/create-checkout-session
 * Crea una sesión de pago de Stripe Checkout
 */
export const createCheckoutSession = async (req, res) => {
  try {
    const { cart, userId, guestId, address } = req.body;

    // Log incoming payload for debugging metadata issues
    console.log('[Stripe] createCheckoutSession incoming payload: userId type=', typeof userId, 'userId=', userId, 'guestId type=', typeof guestId, 'guestId=', guestId);

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
    console.log('[Stripe] Metadata to be attached - userId:', metadataUserId, 'guestId:', metadataGuestId);

    if ( !cart || cart.length === 0 ) {
      return res.status(400).json({ 
        message: "El carrito está vacío" 
      });
    }

    // VALIDA QUE AL MENOS HAYA UN IDENTIFICADOR DE CLIENTE
    if ( !userId && !guestId ) {
      return res.status(400).json({ 
        message: "Falta información de usuario o invitado" 
      });
    }

    const lineItems = cart.map((item) => {
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


    // Debug: Log cart payload to see coupon structure
    console.log('[Stripe] Cart payload preview (first item):', cart && cart[0] ? {
      code_cupon: cart[0].code_cupon,
      code_discount: cart[0].code_discount,
      discount: cart[0].discount,
      type_discount: cart[0].type_discount
    } : 'no items');

    // Normalize/sanitize cart items to ensure productId and variedadId are present
    const sanitizedCart = (Array.isArray(cart) ? cart : []).map((item) => ({
      productId: item.product?.id ?? item.productId ?? null,
      variedadId: item.variedad?.id ?? item.variedadId ?? null,
      cantidad: item.cantidad ?? item.quantity ?? 1,
      price_unitario: item.price_unitario ?? item.variedad?.retail_price ?? item.product?.price_usd ?? item.price ?? 0,
      discount: item.discount ?? 0,
      type_discount: item.type_discount ?? null,
      code_cupon: item.code_cupon ?? null,  // CORRECTED: use code_cupon not code_discount
      title: item.product?.title ?? item.title ?? '',
      // Preserve any additional fields that might be useful later
      subtotal: item.subtotal ?? null,
      total: item.total ?? null
    }));

    // Persist full sanitized cart and (optionally) the shipping address in CheckoutCache
    // Store as an object { items, address } so webhook can reproduce the frontend register flow
    let checkoutCache = null;
    try {
      const payloadToStore = { items: sanitizedCart, address: address || null };
      checkoutCache = await CheckoutCache.create({
        userId: userId || null,
        guestId: guestId || null,
        cart: JSON.stringify(payloadToStore)
      });
      console.log('[Stripe] CheckoutCache created id=', checkoutCache.id);
    } catch (cacheErr) {
      console.warn('[Stripe] Could not create CheckoutCache, falling back to metadata cart (may fail on large carts):', cacheErr);
    }
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode        : "payment",
      line_items  : lineItems,
      // Usar placeholder para que Stripe reemplace con el ID de sesión al redirigir
      success_url : `${process.env.URL_FRONTEND}/es/es/account/checkout/successfull?initialized=true&from=step4&fromStripe=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url  : `${process.env.URL_FRONTEND}/es/es/account/checkout/payment?initialized=true&from=step3`,
      metadata    : {
        // always send strings in metadata; choose normalized values
        userId  : metadataUserId || "",
        guestId : metadataGuestId || "",
        email   : address?.email || "",
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

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type !== 'checkout.session.completed') {
    console.log('[Stripe Webhook] Ignoring event type:', event.type);
    return res.json({ received: true });
  }

  const session = event.data.object;

  console.log('[Stripe Webhook] session object (summary):', {
    id: session.id,
    amount_total: session.amount_total,
    currency: session.currency,
    metadata: session.metadata
  });

  const userId = Number(session.metadata.userId) || null;
  const guestId = Number(session.metadata.guestId) || null;

  try {
    // Crear venta
    const sale = await Sale.create({
      userId,
      guestId,
      currency_payment: session.currency,
      method_payment: 'STRIPE',
      n_transaction: `STRIPE_${session.id}`,
      stripeSessionId: session.id,
      total: (session.amount_total ?? 0) / 100,
    });

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
          code_cupon: c.code_cupon  // CORRECTED: use code_cupon
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
          code_cupon: c.code_cupon  // CORRECTED: use code_cupon
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

        const price_unitario = item.price_unitario != null ? Number(item.price_unitario) : (item.price != null ? Number(item.price) : 0);
        const cantidad = item.cantidad != null ? Number(item.cantidad) : 1;
        
        // Fix: Manejar discount y type_discount correctamente
        const discount = item.discount != null ? Number(item.discount) : 0;
        const type_discount = item.type_discount || 1; // 1 = porcentaje (valor por defecto)
        const code_cupon = item.code_cupon || null;

        const subtotal = item.subtotal != null ? Number(item.subtotal) : parseFloat((price_unitario * cantidad).toFixed(2));
        const total = item.total != null ? Number(item.total) : subtotal;

        let resolvedProductId = item.productId || null;
        if (!resolvedProductId && item.variedadId) {
          try {
            const variedadRow = await Variedad.findByPk(item.variedadId);
            if (variedadRow && variedadRow.productId) {
              resolvedProductId = variedadRow.productId;
              console.log(`[Stripe Webhook] Resolved productId=${resolvedProductId} from variedadId=${item.variedadId}`);
            }
          } catch (resolveErr) {
            console.warn('[Stripe Webhook] Could not resolve productId from Variedad for variedadId=', item.variedadId, resolveErr && (resolveErr.message || resolveErr));
          }
        }

        const detailPayload = {
          saleId: sale.id,
          productId: resolvedProductId,
          variedadId: item.variedadId || null,
          cantidad: cantidad,
          price_unitario: price_unitario,
          discount: discount,
          type_discount: type_discount,
          code_cupon: code_cupon,  // CORRECTED
          subtotal: subtotal,
          total: total,
        };

        console.log('[Stripe Webhook] 🎟️ SaleDetail values before create:', { 
          saleId: sale.id, 
          productId: resolvedProductId,
          variedadId: item.variedadId,
          code_cupon: code_cupon, 
          discount: discount, 
          type_discount: type_discount,
          price_unitario: price_unitario,
          cantidad: cantidad,
          subtotal: subtotal,
          total: total
        });

        console.log('[Stripe Webhook] 📦 Final SaleDetail payload:', detailPayload);

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

    console.log('[Stripe Webhook] Created SaleDetails count=', createdDetailsCount, 'for saleId=', sale.id);

    // Verificar que se crearon TODOS los SaleDetails esperados
    const saleDetailsCreationSuccess = (expectedCount > 0 && createdDetailsCount === expectedCount);
    console.log(`[Stripe Webhook] 📊 SaleDetails verification: expected=${expectedCount}, created=${createdDetailsCount}, success=${saleDetailsCreationSuccess}`);

    if (!saleDetailsCreationSuccess) {
      console.error(`[Stripe Webhook] ❌ ERROR: No se crearon todos los SaleDetails. Expected: ${expectedCount}, Created: ${createdDetailsCount}`);
      console.error(`[Stripe Webhook] ❌ NO SE LIMPIARÁ EL CARRITO para preservar datos para debugging`);
      return res.status(500).json({ 
        received: false, 
        error: 'SaleDetails creation failed',
        expected: expectedCount,
        created: createdDetailsCount
      });
    }

    // Decrementar cupones solo si todos los SaleDetails se crearon exitosamente
    console.log(`🎟️ [Stripe Webhook] Iniciando decremento de cupones para ${cartItems.length} items`);
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
          const price_unitario = it.price_unitario != null ? Number(it.price_unitario) : (it.price != null ? Number(it.price) : 0);
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

        const pfOrder = {
          recipient,
          items: pfItems,
          retail_costs: { subtotal: subtotal.toFixed(2), discount: '0.00', shipping: '0.00', tax: '0.00' },

          external_id: `sale_${sale.id}_${Date.now()}`,  // único para la venta de Stripe
          shipping: 'STANDARD',                           // o el método que quieras
          //confirm: true                                   // para que Printful cree la orden real
        };

        // 🔹 Console log para depuración
        console.log('[Stripe Webhook] pfOrder payload to send to Printful:', JSON.stringify(pfOrder, null, 2));

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
};

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
