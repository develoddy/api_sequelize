import { Op, Sequelize } from 'sequelize';
import Stripe from 'stripe';
import { Sale } from '../models/Sale.js';
import { SaleDetail } from '../models/SaleDetail.js';
import { Variedad } from '../models/Variedad.js';
import { Cart } from '../models/Cart.js';
import { CartCache } from '../models/CartCache.js';
import { CheckoutCache } from '../models/CheckoutCache.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16', // o la que uses
});

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


    // Normalize/sanitize cart items to ensure productId and variedadId are present
    const sanitizedCart = (Array.isArray(cart) ? cart : []).map((item) => ({
      productId: item.product?.id ?? item.productId ?? null,
      variedadId: item.variedad?.id ?? item.variedadId ?? null,
      cantidad: item.cantidad ?? item.quantity ?? 1,
      price_unitario: item.price_unitario ?? item.variedad?.retail_price ?? item.product?.price_usd ?? item.price ?? 0,
      discount: item.discount ?? 0,
      code_discount: item.code_discount ?? null,
      title: item.product?.title ?? item.title ?? '',
      // Preserve any additional fields that might be useful later
      subtotal: item.subtotal ?? null,
      total: item.total ?? null
    }));

    // Persist full sanitized cart in CheckoutCache to avoid Stripe metadata size limits
    let checkoutCache = null;
    try {
      checkoutCache = await CheckoutCache.create({
        userId: userId || null,
        guestId: guestId || null,
        cart: JSON.stringify(sanitizedCart)
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

  if (event.type === 'checkout.session.completed') {
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

      // Crear detalles del carrito: preferir metadata.cart (si frontend la envía),
      // si no, recuperar los carritos desde la DB usando userId/guestId
      let cartItems = [];

        // 1) Prefer checkout cache referenced via metadata.cartId
        const cartIdFromMetadata = session.metadata?.cartId || session.metadata?.cart_id || session.metadata?.cartid || null;
        // tracking vars to decide whether to delete the cache after successful processing
        let checkoutCacheId = null;
        let checkoutCacheRowFound = false;
        if (cartIdFromMetadata) {
          try {
            console.log('[Stripe Webhook] Found cartId in metadata:', cartIdFromMetadata);
            const cacheRow = await CheckoutCache.findByPk(Number(cartIdFromMetadata));
            if (cacheRow && cacheRow.cart) {
              cartItems = JSON.parse(cacheRow.cart || '[]');
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

      // 2) Fallback to metadata.cart if no cache or cache missing
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
            code_discount: c.code_discount
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
            code_discount: c.code_discount
          }));
          console.log('[Stripe Webhook] Loaded carts from CartCache for guestId=', guestId, 'count=', cartsCache.length);
        }
      }

      console.log('[Stripe Webhook] Final cartItems to persist count=', Array.isArray(cartItems) ? cartItems.length : 0, 'sourceIsCache=', sourceIsCache);

      // Crear cada SaleDetail con manejo de errores por item y logs
      let createdDetailsCount = 0;
      for (const item of cartItems) {
        try {
          // Normalize numeric fields and compute subtotal/total if missing
          const price_unitario = item.price_unitario != null ? Number(item.price_unitario) : (item.price != null ? Number(item.price) : 0);
          const cantidad = item.cantidad != null ? Number(item.cantidad) : 1;
          const discount = item.discount != null ? Number(item.discount) : 0;
          const code_discount = item.code_discount || null;

          const subtotal = item.subtotal != null ? Number(item.subtotal) : parseFloat((price_unitario * cantidad).toFixed(2));
          const total = item.total != null ? Number(item.total) : subtotal;

          // If productId is missing in metadata, try to resolve it from Variedad
          let resolvedProductId = item.productId || null;
          if (!resolvedProductId && item.variedadId) {
            try {
              const variedadRow = await Variedad.findByPk(item.variedadId);
              if (variedadRow && variedadRow.productId) {
                resolvedProductId = variedadRow.productId;
                // Log in the requested format so it's easy to grep
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
            code_discount: code_discount,
            subtotal: subtotal,
            total: total,
          };

          console.log('[Stripe Webhook] creating SaleDetail payload:', detailPayload);

          const created = await SaleDetail.create(detailPayload);
          createdDetailsCount++;
          // Log the created SaleDetail in a concise, easy-to-search format
          console.log(`[Stripe Webhook] SaleDetail creado: { saleId: ${sale.id}, productId: ${detailPayload.productId}, variedadId: ${detailPayload.variedadId} }`);
        } catch (detailErr) {
          console.error('[Stripe Webhook] Error creando SaleDetail para saleId=' + sale.id + ' item=', item, detailErr && (detailErr.stack || detailErr.message || detailErr));
        }
      }

      console.log('[Stripe Webhook] Created SaleDetails count=', createdDetailsCount, 'for saleId=', sale.id);

      // Si vinimos desde CheckoutCache y TODOS los detalles se crearon correctamente,
      // eliminar la fila de CheckoutCache para mantener la DB limpia.
      try {
        const expectedCount = Array.isArray(cartItems) ? cartItems.length : 0;
        if (checkoutCacheRowFound && checkoutCacheId) {
          if (expectedCount > 0 && createdDetailsCount === expectedCount) {
            await CheckoutCache.destroy({ where: { id: checkoutCacheId } });
            console.log(`[Stripe Webhook] Deleted CheckoutCache id=${checkoutCacheId} after successful processing`);
          } else {
            console.log(`[Stripe Webhook] Not deleting CheckoutCache id=${checkoutCacheId} because createdDetailsCount=${createdDetailsCount} != cartItems.length=${expectedCount}`);
          }
        }
      } catch (delCacheErr) {
        console.warn('[Stripe Webhook] Failed to delete CheckoutCache id=', checkoutCacheId, delCacheErr && (delCacheErr.message || delCacheErr));
      }

      // Si vinimos desde DB, eliminar los items del carrito originales
      if (sourceCarts && sourceCarts.length > 0) {
        try {
          for (const c of sourceCarts) {
            try {
              if (c && c.id) {
                if (sourceIsCache) {
                  await CartCache.destroy({ where: { id: c.id } });
                } else {
                  await Cart.destroy({ where: { id: c.id } });
                }
              }
            } catch (delErr) {
              console.warn('[Stripe Webhook] No se pudo eliminar item de carrito fuente id=', c && c.id, delErr && (delErr.message || delErr));
            }
          }
        } catch (delAllErr) {
          console.error('[Stripe Webhook] Error eliminando items de carrito fuente:', delAllErr && (delAllErr.stack || delAllErr.message || delAllErr));
        }
      }

      console.log('[Stripe Webhook] Venta y detalles registrados correctamente, saleId=', sale.id);
    } catch (err) {
      console.error('[Stripe Webhook] Error registrando venta + detalles:', err);
    }
  }

  res.json({ received: true });
};
