/**
 * Script de configuración: MailFlow SaaS Config
 * 
 * Configura el saas_config y type='saas' de MailFlow en la base de datos.
 * Ejecutar: node scripts/configure-mailflow-saas.mjs
 */

import '../src/config/env.js';
import { Module } from '../src/models/Module.js';

const mailflowSaasConfig = {
  trial_days: 14,
  api_endpoint: '/api/mailflow',
  dashboard_route: '/mailflow/dashboard',
  pricing: [
    {
      name: 'Starter',
      price: 29,
      description: 'Perfect for small businesses starting with email marketing',
      currency: 'EUR',
      stripe_price_id: process.env.STRIPE_STARTER_PRICE_ID || 'price_starter',
      recommended: false
    },
    {
      name: 'Professional',
      price: 79,
      description: 'Advanced features for growing businesses',
      currency: 'EUR',
      stripe_price_id: process.env.STRIPE_PRO_PRICE_ID || 'price_pro',
      recommended: true
    },
    {
      name: 'Enterprise',
      price: 199,
      description: 'Complete solution with priority support',
      currency: 'EUR',
      stripe_price_id: process.env.STRIPE_ENTERPRISE_PRICE_ID || 'price_enterprise',
      recommended: false
    }
  ]
};

async function configureMailflowSaaS() {
  try {
    console.log('🚀 Configurando MailFlow SaaS Config...');
    
    // Buscar módulo MailFlow
    const mailflowModule = await Module.findOne({
      where: { key: 'mailflow' }
    });
    
    if (!mailflowModule) {
      console.error('❌ Módulo MailFlow no encontrado en la base de datos');
      console.log('💡 Asegúrate de que el módulo esté creado en la tabla modules');
      process.exit(1);
    }
    
    // Actualizar saas_config y type
    await mailflowModule.update({
      type: 'saas',
      saas_config: mailflowSaasConfig
    });
    
    console.log('✅ MailFlow SaaS Config configurado correctamente');
    console.log('📋 Configuración aplicada:');
    console.log(JSON.stringify(mailflowSaasConfig, null, 2));
    
    // Verificar configuración
    const updatedModule = await Module.findOne({
      where: { key: 'mailflow' }
    });
    
    console.log('\n✅ Verificación:');
    console.log(`- Type: ${updatedModule.type}`);
    console.log(`- Active: ${updatedModule.is_active}`);
    console.log(`- Status: ${updatedModule.status}`);
    console.log(`- Trial Days: ${updatedModule.saas_config?.trial_days || 'N/A'}`);
    console.log(`- Dashboard Route: ${updatedModule.saas_config?.dashboard_route || 'N/A'}`);
    console.log(`- Planes: ${updatedModule.saas_config?.pricing?.length || 0}`);
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error al configurar SaaS:', error);
    process.exit(1);
  }
}

// Ejecutar
configureMailflowSaaS();
