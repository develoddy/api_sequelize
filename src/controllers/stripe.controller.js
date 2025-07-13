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
    const { cart, user, guestId, address } = req.body;

    if (!cart || cart.length === 0) {
      return res.status(400).json({ message: "El carrito está vacío." });
    }

    const lineItems = cart.map((item) => ({
      price_data: {
        currency: "eur",
        product_data: {
          name: item.product.title,
        },
        unit_amount: Math.round(Number(item.product.price_usd) * 100), // € a céntimos
      },
      quantity: item.cantidad,
    }));

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: lineItems,
      success_url: `${process.env.URL_FRONTEND}/es/es/account/checkout/successfull`,
      cancel_url: `${process.env.URL_FRONTEND}/checkout/cancel`,
      metadata: {
        userId: user || "",
        guestId: guestId || "",
        email: address?.email || "",
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
