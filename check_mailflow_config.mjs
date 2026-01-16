import { Module } from './src/models/Module.js';
import dotenv from 'dotenv';
dotenv.config();

(async () => {
  try {
    const module = await Module.findOne({ where: { key: 'mailflow' } });
    
    if (!module) {
      console.log('❌ Módulo mailflow no encontrado');
      process.exit(1);
    }
    
    console.log('📦 Módulo mailflow:');
    console.log('- key:', module.key);
    console.log('- type:', module.type);
    console.log('- status:', module.status);
    console.log('- saas_config:', JSON.stringify(module.saas_config, null, 2));
    
    if (module.saas_config?.dashboard_route) {
      const cleaned = module.saas_config.dashboard_route.replace(/^\/+/, '');
      console.log('\n🎯 dashboard_route (limpio):', `/${cleaned}`);
      console.log('🌐 URL completa sería:', `http://localhost:4200/${cleaned}`);
    } else {
      console.log('\n⚠️ No tiene dashboard_route, se usará fallback: /mailflow');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
})();
