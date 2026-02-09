'use strict';

/**
 * Migration: Add Video Express module to modules table
 * 
 * Registra el módulo experimental Video Express siguiendo
 * la arquitectura de módulos existente.
 * 
 * @author LujanDev
 * @date 2026-02-09
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    // Insertar módulo Video Express
    await queryInterface.bulkInsert('modules', [{
      key: 'video-express',
      name: 'Video Express',
      description: 'Convierte fotos de productos en videos cortos para redes sociales en minutos, sin edición manual.',
      type: 'service',
      is_active: true,
      status: 'testing',
      validation_days: 14,
      validation_target_sales: 5,
      launched_at: new Date(),
      icon: '🎬',
      color: 'primary',
      
      // Toda la configuración va en el campo config (JSON)
      config: JSON.stringify({
        // Metadata
        tagline: 'De foto a video en segundos. Listo para publicar.',
        detailed_description: '<h2>Genera videos de producto automáticamente</h2><p>Video Express usa IA para convertir tus fotos de producto en videos optimizados para TikTok, Instagram y Facebook.</p><ul><li>Sube tu imagen de producto</li><li>Elige tu objetivo (engagement o ventas)</li><li>Descarga tu video en menos de 60 segundos</li></ul><p><strong>Sin edición. Sin configuración. Solo resultados.</strong></p>',
        
        // Config técnica
        provider: 'fal.ai',
        model: 'fal-ai/fast-animatediff/text-to-video',
        video_duration: 5,
        video_resolution: '1080x1920',
        formats: ['mp4'],
        max_uploads_per_hour: 10,
        max_generations_per_hour: 5,
        pricing_model: 'pay-per-video',
        
        // Preview config
        preview_config: {
          enabled: true,
          route: '/preview/video-express',
          public_endpoint: '/api/video-express/preview',
          show_in_store: true,
          demo_button_text: 'Probar gratis',
          generator_type: 'custom',
          conversion_config: {
            recovery_key: 'video-express-preview',
            redirect_route: '/video-express/dashboard',
            auto_activate: true
          },
          rate_limiting: {
            max_requests: 5,
            window_minutes: 60
          }
        },
        
        // UI config
        ui_config: {
          accent_color: '#8B5CF6',
          category: 'content-creation',
          featured: true,
          homepage_priority: 1,
          tags: ['video', 'ai', 'social-media', 'automation', 'content'],
          screenshots: [],
          demo_video_url: null
        },
        
        // Pricing config
        pricing_config: {
          free_tier: {
            enabled: true,
            videos_per_month: 3,
            watermark: false,
            max_duration: 5
          },
          paid_tiers: [
            {
              name: 'Starter',
              price_monthly: 9.99,
              price_yearly: 99.00,
              videos_per_month: 50,
              features: [
                'Hasta 50 videos/mes',
                'Sin marca de agua',
                'Resolución 1080p',
                'Soporte por email'
              ]
            },
            {
              name: 'Pro',
              price_monthly: 29.99,
              price_yearly: 299.00,
              videos_per_month: 200,
              features: [
                'Hasta 200 videos/mes',
                'Sin marca de agua',
                'Resolución 1080p',
                'Estilos premium',
                'Prioridad en generación',
                'Soporte prioritario'
              ]
            }
          ]
        }
      }),
      
      created_at: new Date(),
      updated_at: new Date()
    }]);
    
    console.log('✅ Módulo video-express registrado exitosamente');
  },

  async down(queryInterface, Sequelize) {
    // Eliminar módulo Video Express
    await queryInterface.bulkDelete('modules', {
      key: 'video-express'
    });
    
    console.log('✅ Módulo video-express eliminado');
  }
};
