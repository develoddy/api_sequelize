// src/devtools/utils/stripe.js
import Stripe from 'stripe';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Obtener __dirname en ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envFile = process.env.NODE_ENV === 'production' 
    ? '.env.production' 
    : '.env.development';

// Ruta absoluta para asegurar que PM2 encuentre el archivo
const envPath = path.resolve(__dirname, '../../..', envFile);
dotenv.config({ path: envPath });

const stripeSecret = process.env.STRIPE_SECRET_KEY;
if (!stripeSecret) {
  console.error(`❌ STRIPE_SECRET_KEY no encontrada en: ${envPath}`);
  console.error(`NODE_ENV: ${process.env.NODE_ENV}`);
  throw new Error("❌ STRIPE_SECRET_KEY no encontrada. Revisa tu .env");
}

const stripe = new Stripe(stripeSecret, { apiVersion: '2023-08-16' });
export default stripe;
