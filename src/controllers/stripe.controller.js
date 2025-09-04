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

    const lineItems = cart.map((item) => ({
      price_data: {
        currency     : "eur",
        product_data : {
          name : item.product.title,
        },
        unit_amount  : Math.round(Number(item.product.price_usd) * 100), // € a céntimos
      },
      quantity: item.cantidad,
    }));


    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode        : "payment",
      line_items  : lineItems,
      success_url : `${process.env.URL_FRONTEND}/es/es/account/checkout/successfull?initialized=true&from=step4&fromStripe=1`,
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
