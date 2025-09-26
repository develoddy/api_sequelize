import { Op, Sequelize } from 'sequelize';
import Stripe from 'stripe';

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


    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode        : "payment",
      line_items  : lineItems,
      // Usar placeholder para que Stripe reemplace con el ID de sesión al redirigir
      success_url : `${process.env.URL_FRONTEND}/es/es/account/checkout/successfull?initialized=true&from=step4&fromStripe=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url  : `${process.env.URL_FRONTEND}/es/es/account/checkout/payment?initialized=true&from=step3`,
      metadata    : {
        userId  : userId || "",
        guestId : guestId || "",
        email   : address?.email || "",
      },
    });

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
