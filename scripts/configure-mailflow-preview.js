/**
 * Script de configuración: MailFlow Preview Mode
 * 
 * Configura el preview_config de MailFlow en la base de datos.
 * Ejecutar: node scripts/configure-mailflow-preview.js
 */

import '../src/config/env.js'; // Cargar variables de entorno primero
import Module from '../src/models/Module.js';

const mailflowPreviewConfig = {
  enabled: true,
  route: '/preview/mailflow',
  public_endpoint: '/api/modules/mailflow/preview/generate',
  show_in_store: true,
  demo_button_text: 'Try Demo - No signup required',
  generator_function: 'generateMailflowPreview',
  conversion_config: {
    recovery_key: 'mailflow_preview',
    redirect_route: '/mailflow/onboarding',
    auto_activate: true
  },
  rate_limiting: {
    max_requests: 10,
    window_minutes: 15
  }
};

async function configureMailflowPreview() {
  try {
    console.log('🚀 Configurando MailFlow Preview Mode...');
    
    // Buscar módulo MailFlow
    const mailflowModule = await Module.findOne({
      where: { key: 'mailflow' }
    });
    
    if (!mailflowModule) {
      console.error('❌ Módulo MailFlow no encontrado en la base de datos');
      console.log('💡 Asegúrate de que el módulo esté creado en la tabla modules');
      process.exit(1);
    }
    
    // Actualizar preview_config
    await mailflowModule.update({
      preview_config: mailflowPreviewConfig
    });
    
    console.log('✅ MailFlow Preview Mode configurado correctamente');
    console.log('📋 Configuración aplicada:');
    console.log(JSON.stringify(mailflowPreviewConfig, null, 2));
    
    // Verificar configuración
    const updatedModule = await Module.findOne({
      where: { key: 'mailflow' }
    });
    
    console.log('\n✅ Verificación:');
    console.log(`- Preview habilitado: ${updatedModule.hasPreviewEnabled()}`);
    console.log(`- Ruta pública: ${updatedModule.getPreviewRoute()}`);
    console.log(`- Endpoint: ${updatedModule.preview_config.public_endpoint}`);
    console.log(`- Mostrar en tienda: ${updatedModule.shouldShowInStore()}`);
    console.log(`- Botón demo: "${updatedModule.getDemoButtonText()}"`);
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error al configurar preview:', error);
    process.exit(1);
  }
}

// Ejecutar
configureMailflowPreview();
