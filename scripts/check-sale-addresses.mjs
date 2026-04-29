#!/usr/bin/env node

/**
 * Script para verificar por qué no se están creando SaleAddress
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import mysql from 'mysql2/promise';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar variables de entorno
const envPath = join(__dirname, '..', '.env.development');
dotenv.config({ path: envPath });

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'ecommercedb',
  timezone: '+00:00'
};

async function checkSaleAddresses() {
  console.log('🔍 ===== VERIFICACIÓN DE SALEADDRESS =====\n');
  
  const connection = await mysql.createConnection(DB_CONFIG);
  console.log('✅ Conectado a MySQL\n');
  
  try {
    // Verificar ventas 38-42
    const saleIds = [38, 39, 40, 41, 42];
    
    console.log('📊 Verificando ventas recientes:', saleIds.join(', '), '\n');
    
    for (const saleId of saleIds) {
      console.log(`\n🔹 Sale ${saleId}:`);
      
      // 1. Verificar si tiene SaleAddress
      const [addresses] = await connection.query(
        `SELECT * FROM sale_addresses WHERE saleId = ?`,
        [saleId]
      );
      
      if (addresses.length > 0) {
        console.log(`   ✅ Tiene SaleAddress:`);
        console.log(`      Email: ${addresses[0].email}`);
        console.log(`      Name: ${addresses[0].name}`);
      } else {
        console.log(`   ❌ NO tiene SaleAddress`);
      }
      
      // 2. Buscar CheckoutCache asociado
      const [sales] = await connection.query(
        `SELECT stripeSessionId FROM sales WHERE id = ?`,
        [saleId]
      );
      
      if (sales.length > 0) {
        const sessionId = sales[0].stripeSessionId;
        console.log(`   Stripe Session: ${sessionId}`);
        
        // Buscar en CheckoutCache por userId/guestId de la venta
        const [saleData] = await connection.query(
          `SELECT userId, guestId FROM sales WHERE id = ?`,
          [saleId]
        );
        
        if (saleData.length > 0) {
          const { userId, guestId } = saleData[0];
          console.log(`   User ID: ${userId || 'NULL'}, Guest ID: ${guestId || 'NULL'}`);
          
          // Buscar webhook de checkout.session.completed
          const [webhooks] = await connection.query(
            `SELECT id, event_type, status, response_message 
             FROM stripe_webhook_logs 
             WHERE event_type = 'checkout.session.completed'
               AND payload LIKE ? 
             ORDER BY created_at DESC LIMIT 1`,
            [`%${sessionId}%`]
          );
          
          if (webhooks.length > 0) {
            console.log(`   ✅ Webhook checkout.session.completed (id: ${webhooks[0].id})`);
            console.log(`      Status: ${webhooks[0].status}`);
            const msg = webhooks[0].response_message || '';
            console.log(`      Message: ${msg.substring(0, 100)}${msg.length > 100 ? '...' : ''}`);
          } else {
            console.log(`   ❌ NO hay webhook checkout.session.completed`);
          }
        }
      }
    }
    
    console.log('\n\n💡 ===== CONCLUSIÓN =====\n');
    console.log('Si las ventas NO tienen SaleAddress pero SÍ tienen CheckoutCache con address.email,');
    console.log('entonces el problema está en la lógica del webhook que NO está leyendo correctamente');
    console.log('el CheckoutCache o el session.metadata.email de Stripe.\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await connection.end();
    console.log('📡 Conexión cerrada');
  }
}

checkSaleAddresses().catch(console.error);
