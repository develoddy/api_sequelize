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
    
    console.log('📦 Configuración actual de mailflow:');
    console.log('dashboard_route:', module.saas_config?.dashboard_route || 'NO CONFIGURADO');
    
    console.log('\n🔧 Actualizando dashboard_route a: /mailflow (sin /dashboard)...');
    
    module.saas_config = {
      ...module.saas_config,
      dashboard_route: '/mailflow'
    };
    
    await module.save();
    
    console.log('✅ Actualizado correctamente');
    console.log('Nueva configuración:', module.saas_config.dashboard_route);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
})();
