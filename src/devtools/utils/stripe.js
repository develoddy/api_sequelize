// src/devtools/utils/stripe.js
import Stripe from 'stripe';

// Las variables de entorno ya están cargadas por index.js
// Inicialización directa
const stripeSecret = process.env.STRIPE_SECRET_KEY;
if (!stripeSecret) {
  console.error(`❌ STRIPE_SECRET_KEY no encontrada`);
  console.error(`NODE_ENV: ${process.env.NODE_ENV}`);
  throw new Error("❌ STRIPE_SECRET_KEY no encontrada. Revisa tu .env");
}

const stripe = new Stripe(stripeSecret, { apiVersion: '2023-08-16' });
export default stripe;
