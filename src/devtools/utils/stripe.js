// src/devtools/utils/stripe.js
import Stripe from 'stripe';

// Inicialización lazy: Solo se crea cuando se accede por primera vez
// Las variables de entorno ya deben estar cargadas por index.js
let stripeInstance = null;

function getStripeInstance() {
  if (!stripeInstance) {
    const stripeSecret = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecret) {
      console.error(`❌ STRIPE_SECRET_KEY no encontrada`);
      console.error(`NODE_ENV: ${process.env.NODE_ENV}`);
      console.error(`Variables disponibles:`, Object.keys(process.env).filter(k => k.includes('STRIPE')));
      throw new Error("❌ STRIPE_SECRET_KEY no encontrada. Revisa tu .env");
    }
    stripeInstance = new Stripe(stripeSecret, { apiVersion: '2023-08-16' });
  }
  return stripeInstance;
}

// Proxy para que funcione como import default
const stripeProxy = new Proxy({}, {
  get(target, prop) {
    return getStripeInstance()[prop];
  }
});

export default stripeProxy;
