/**
 * Script para verificar los precios reales en Stripe Dashboard
 */

import Stripe from 'stripe';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const priceIds = [
  { name: 'Starter (esperado: 9.99€)', id: 'price_1Sp9b2CtfffoVXXrSSt8lghD' },
  { name: 'Profesional (esperado: 29.99€)', id: 'price_1Sp9eNCtfffoVXXrPjCvFSsk' },
  { name: 'Business (esperado: 79.99€)', id: 'price_1Sp9eNCtfffoVXXrSy2nnjhi' }
];

console.log('🔍 Verificando Price IDs en Stripe Dashboard:\n');

for (const priceInfo of priceIds) {
  try {
    const price = await stripe.prices.retrieve(priceInfo.id);
    const amount = price.unit_amount / 100;
    
    console.log(`📋 ${priceInfo.name}`);
    console.log(`   Price ID: ${price.id}`);
    console.log(`   💰 Precio REAL en Stripe: ${amount}€`);
    console.log(`   Producto: ${price.product}`);
    console.log(`   Activo: ${price.active ? '✅' : '❌'}`);
    console.log('');
  } catch (error) {
    console.log(`❌ Error verificando ${priceInfo.name}: ${error.message}\n`);
  }
}
