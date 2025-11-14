// src/devtools/utils/stripe.js
import Stripe from 'stripe';
import * as dotenv from 'dotenv';

const envFile = process.env.NODE_ENV === 'production' 
    ? '.env.production' 
    : '.env.development';

dotenv.config({ path: envFile });

const stripeSecret = process.env.STRIPE_SECRET_KEY;
if (!stripeSecret) {
  throw new Error("❌ STRIPE_SECRET_KEY no encontrada. Revisa tu .env");
}

const stripe = new Stripe(stripeSecret, { apiVersion: '2023-08-16' });
export default stripe;
