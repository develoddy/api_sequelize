#!/usr/bin/env node

/**
 * Script de diagnóstico para verificar integración ecommerce <-> tenant <-> sales
 * Analiza tenant 43 (LujanDev), configuración de Stripe, y flujo de ventas
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Cargar .env.development desde la carpeta api
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '../.env.development') });

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'ecommercedb'
};

async function diagnosticEcommerceTenantSales() {
  console.log('🔍 ===== DIAGNÓSTICO: ECOMMERCE → TENANT → SALES =====\n');
  
  let connection;
  
  try {
    // Conectar a MySQL
    console.log('📡 Conectando a MySQL...');
    connection = await mysql.createConnection(DB_CONFIG);
    console.log('✅ Conectado a MySQL\n');
    
    // ========================================================================
    // 1. VERIFICAR TENANT 43 (LujanDev)
    // ========================================================================
    console.log('🏢 ===== 1. VERIFICACIÓN DE TENANT 43 (LujanDev) =====');
    
    const [tenants] = await connection.query(`
      SELECT 
        id, 
        name,
        email, 
        status, 
        plan,
        module_key,
        JSON_EXTRACT(settings, '$.store_url') as store_url,
        JSON_EXTRACT(settings, '$.printful_api_key') as printful_api_key,
        JSON_EXTRACT(settings, '$.stripe_webhook_secret') as stripe_webhook_secret,
        stripe_customer_id,
        stripe_subscription_id,
        created_at
      FROM tenants 
      WHERE id = 43
    `);
    
    if (tenants.length === 0) {
      console.log('❌ Tenant 43 NO EXISTE en la base de datos');
    } else {
      const tenant = tenants[0];
      console.log('✅ Tenant 43 encontrado:');
      console.log(`   Name: ${tenant.name}`);
      console.log(`   Email: ${tenant.email}`);
      console.log(`   Status: ${tenant.status}`);
      console.log(`   Plan: ${tenant.plan}`);
      console.log(`   Module Key: ${tenant.module_key}`);
      console.log(`   Store URL: ${tenant.store_url || 'NULL'}`);
      console.log(`   Printful API Key: ${tenant.printful_api_key ? '✅ CONFIGURADO' : '❌ NO CONFIGURADO'}`);
      console.log(`   Stripe Webhook Secret: ${tenant.stripe_webhook_secret ? '✅ CONFIGURADO' : '❌ NO CONFIGURADO'}`);
      console.log(`   Stripe Customer ID: ${tenant.stripe_customer_id || 'NULL'}`);
      console.log(`   Stripe Subscription ID: ${tenant.stripe_subscription_id || 'NULL'}`);
      console.log(`   Created At: ${tenant.created_at}`);
    }
    console.log('');
    
    // ========================================================================
    // 2. VERIFICAR VENTAS RECIENTES CON tenant_id
    // ========================================================================
    console.log('💰 ===== 2. VERIFICACIÓN DE VENTAS RECIENTES =====');
    
    const [recentSales] = await connection.query(`
      SELECT 
        id,
        tenant_id,
        userId,
        guestId,
        total,
        method_payment,
        n_transaction,
        stripeSessionId,
        syncStatus,
        trackingToken,
        createdAt
      FROM sales 
      ORDER BY createdAt DESC 
      LIMIT 10
    `);
    
    console.log(`📊 Total de ventas recientes: ${recentSales.length}\n`);
    
    if (recentSales.length === 0) {
      console.log('⚠️  No se encontraron ventas recientes');
    } else {
      console.log('Últimas 10 ventas:');
      recentSales.forEach((sale, index) => {
        console.log(`\n${index + 1}. Sale ID: ${sale.id}`);
        console.log(`   Tenant ID: ${sale.tenant_id || '❌ NULL'}`);
        console.log(`   Total: $${sale.total}`);
        console.log(`   Método: ${sale.method_payment}`);
        console.log(`   Sync Status: ${sale.syncStatus || 'NULL'}`);
        console.log(`   Stripe Session: ${sale.stripeSessionId || 'NULL'}`);
        console.log(`   Tracking Token: ${sale.trackingToken || 'NULL'}`);
        console.log(`   Fecha: ${sale.createdAt}`);
      });
    }
    console.log('');
    
    // ========================================================================
    // 3. VERIFICAR VENTAS SIN tenant_id ASIGNADO
    // ========================================================================
    console.log('⚠️  ===== 3. VENTAS SIN TENANT_ID =====');
    
    const [salesWithoutTenant] = await connection.query(`
      SELECT COUNT(*) as count
      FROM sales 
      WHERE tenant_id IS NULL
    `);
    
    const countWithoutTenant = salesWithoutTenant[0].count;
    console.log(`📊 Ventas sin tenant_id: ${countWithoutTenant}`);
    
    if (countWithoutTenant > 0) {
      const [recentWithoutTenant] = await connection.query(`
        SELECT id, total, method_payment, createdAt
        FROM sales 
        WHERE tenant_id IS NULL
        ORDER BY createdAt DESC
        LIMIT 5
      `);
      
      console.log('\nÚltimas 5 ventas sin tenant_id:');
      recentWithoutTenant.forEach(sale => {
        console.log(`   Sale ${sale.id}: $${sale.total} - ${sale.method_payment} - ${sale.createdAt}`);
      });
    }
    console.log('');
    
    // ========================================================================
    // 4. VERIFICAR WEBHOOKS DE STRIPE
    // ========================================================================
    console.log('🔔 ===== 4. WEBHOOKS DE STRIPE =====');
    
    const [webhooks] = await connection.query(`
      SELECT 
        id,
        event_id,
        event_type,
        tenant_id,
        status,
        response_message,
        retry_count,
        created_at
      FROM stripe_webhook_logs 
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    
    console.log(`📊 Total de webhooks recientes: ${webhooks.length}\n`);
    
    if (webhooks.length === 0) {
      console.log('⚠️  No se encontraron webhooks de Stripe registrados');
    } else {
      console.log('Últimos 10 webhooks:');
      webhooks.forEach((webhook, index) => {
        console.log(`\n${index + 1}. Webhook ID: ${webhook.id}`);
        console.log(`   Event Type: ${webhook.event_type}`);
        console.log(`   Tenant ID: ${webhook.tenant_id || '❌ NULL'}`);
        console.log(`   Status: ${webhook.status}`);
        console.log(`   Retry Count: ${webhook.retry_count || 0}`);
        if (webhook.response_message) {
          console.log(`   Message: ${webhook.response_message.substring(0, 100)}...`);
        }
        console.log(`   Fecha: ${webhook.created_at}`);
      });
    }
    console.log('');
    
    // ========================================================================
    // 5. VERIFICAR RELACIÓN SALES <-> SALE_ADDRESSES
    // ========================================================================
    console.log('📧 ===== 5. VERIFICACIÓN DE SALE_ADDRESSES =====');
    
    const [salesWithoutAddress] = await connection.query(`
      SELECT 
        s.id,
        s.tenant_id,
        s.total,
        s.createdAt,
        sa.email
      FROM sales s
      LEFT JOIN sale_addresses sa ON s.id = sa.saleId
      WHERE sa.id IS NULL
      ORDER BY s.createdAt DESC
      LIMIT 5
    `);
    
    console.log(`📊 Ventas sin dirección (últimas 5): ${salesWithoutAddress.length}`);
    
    if (salesWithoutAddress.length > 0) {
      console.log('\nVentas sin SaleAddress:');
      salesWithoutAddress.forEach(sale => {
        console.log(`   Sale ${sale.id}: $${sale.total} - tenant_id: ${sale.tenant_id || 'NULL'} - ${sale.createdAt}`);
      });
    }
    console.log('');
    
    // ========================================================================
    // 6. ANÁLISIS DE CONFIGURACIÓN DE EMAILS
    // ========================================================================
    console.log('📬 ===== 6. CONFIGURACIÓN DE EMAILS =====');
    
    console.log('Variables de entorno SMTP:');
    console.log(`   SMTP_HOST: ${process.env.SMTP_HOST || '❌ NO CONFIGURADO'}`);
    console.log(`   SMTP_PORT: ${process.env.SMTP_PORT || '❌ NO CONFIGURADO'}`);
    console.log(`   EMAIL_USER: ${process.env.EMAIL_USER || '❌ NO CONFIGURADO'}`);
    console.log(`   EMAIL_PASS: ${process.env.EMAIL_PASS ? '✅ CONFIGURADO' : '❌ NO CONFIGURADO'}`);
    console.log('');
    
    // ========================================================================
    // 7. VERIFICAR URL_FRONTEND vs store_url
    // ========================================================================
    console.log('🌐 ===== 7. VERIFICACIÓN DE URLS =====');
    
    console.log(`URL_FRONTEND (.env): ${process.env.URL_FRONTEND || '❌ NO CONFIGURADO'}`);
    
    if (tenants.length > 0) {
      const tenant = tenants[0];
      const storeUrl = tenant.store_url ? JSON.parse(tenant.store_url) : null;
      console.log(`Store URL (tenant 43): ${storeUrl || '❌ NO CONFIGURADO'}`);
      
      if (process.env.URL_FRONTEND && storeUrl) {
        const match = process.env.URL_FRONTEND === storeUrl;
        console.log(`Match: ${match ? '✅ URLs coinciden' : '❌ URLs NO coinciden'}`);
      }
    }
    console.log('');
    
    // ========================================================================
    // 8. DIAGNÓSTICO FINAL
    // ========================================================================
    console.log('🎯 ===== DIAGNÓSTICO FINAL =====\n');
    
    const issues = [];
    const warnings = [];
    const successes = [];
    
    // Verificar tenant
    if (tenants.length === 0) {
      issues.push('❌ Tenant 43 no existe');
    } else {
      const tenant = tenants[0];
      successes.push('✅ Tenant 43 existe y está configurado');
      
      if (!tenant.printful_api_key) {
        warnings.push('⚠️  Printful API Key no configurado en tenant');
      }
      
      if (tenant.status !== 'active') {
        warnings.push(`⚠️  Tenant status: ${tenant.status} (no active)`);
      }
    }
    
    // Verificar ventas
    if (countWithoutTenant > 0) {
      issues.push(`❌ ${countWithoutTenant} ventas sin tenant_id asignado`);
    }
    
    if (recentSales.length > 0) {
      const salesWithTenant = recentSales.filter(s => s.tenant_id).length;
      if (salesWithTenant > 0) {
        successes.push(`✅ ${salesWithTenant}/${recentSales.length} ventas recientes tienen tenant_id`);
      } else {
        issues.push('❌ Ninguna venta reciente tiene tenant_id');
      }
    }
    
    // Verificar webhooks
    if (webhooks.length === 0) {
      warnings.push('⚠️  No hay webhooks de Stripe registrados');
    } else {
      const failedWebhooks = webhooks.filter(w => w.status === 'failed').length;
      if (failedWebhooks > 0) {
        warnings.push(`⚠️  ${failedWebhooks} webhooks fallidos`);
      }
    }
    
    // Verificar SMTP
    if (!process.env.SMTP_HOST || !process.env.EMAIL_USER) {
      issues.push('❌ Configuración SMTP incompleta');
    } else {
      successes.push('✅ Configuración SMTP presente');
    }
    
    // Mostrar resumen
    console.log('ÉXITOS:');
    successes.forEach(s => console.log(`   ${s}`));
    console.log('');
    
    if (warnings.length > 0) {
      console.log('ADVERTENCIAS:');
      warnings.forEach(w => console.log(`   ${w}`));
      console.log('');
    }
    
    if (issues.length > 0) {
      console.log('PROBLEMAS CRÍTICOS:');
      issues.forEach(i => console.log(`   ${i}`));
      console.log('');
    }
    
    // ========================================================================
    // 9. RECOMENDACIONES
    // ========================================================================
    console.log('💡 ===== RECOMENDACIONES =====\n');
    
    if (countWithoutTenant > 0) {
      console.log('1. ASIGNAR tenant_id A VENTAS EXISTENTES:');
      console.log('   UPDATE sales SET tenant_id = 43 WHERE tenant_id IS NULL;');
      console.log('');
    }
    
    if (tenants.length > 0 && tenants[0].store_url) {
      const storeUrl = JSON.parse(tenants[0].store_url);
      if (process.env.URL_FRONTEND !== storeUrl) {
        console.log('2. VERIFICAR URL_FRONTEND en .env:');
        console.log(`   Actual: ${process.env.URL_FRONTEND}`);
        console.log(`   Esperado: ${storeUrl}`);
        console.log('');
      }
    }
    
    console.log('3. VERIFICAR FLUJO DE COMPRA:');
    console.log('   a) Hacer compra de prueba en ecommerce');
    console.log('   b) Verificar que se cree Sale con tenant_id = 43');
    console.log('   c) Verificar que se registre webhook en stripe_webhook_logs');
    console.log('   d) Verificar que se envíe email de confirmación');
    console.log('');
    
  } catch (error) {
    console.error('❌ Error en diagnóstico:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n📡 Conexión cerrada');
    }
  }
}

// Ejecutar diagnóstico
diagnosticEcommerceTenantSales();
