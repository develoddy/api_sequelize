'use strict';

/**
 * Migration: Add MailFlow module to modules table
 * 
 * Registra el módulo MailFlow - Email sequences for indie hackers
 * Sistema de automatización de emails estilo indie hacker.
 * 
 * @author LujanDev
 * @date 2026-05-05
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    // Insertar módulo MailFlow
    await queryInterface.bulkInsert('modules', [{
      key: 'mailflow',
      name: 'MailFlow',
      description: 'Simple email automation without the complexity of MailChimp. Create onboarding sequences in minutes.',
      type: 'service',
      module_type: 'wizard',
      is_active: true,
      status: 'testing',
      show_in_store: true,
      validation_days: 30,
      validation_target_sales: 3,
      launched_at: new Date(),
      icon: '📧',
      color: 'info',
      tagline: 'Email sequences for indie hackers',
      detailed_description: '<h2>Email automation sin complejidad</h2><p>MailFlow te ayuda a automatizar tus secuencias de onboarding por email sin la complejidad y costo de herramientas como MailChimp o ActiveCampaign.</p><p>Perfecto para indie hackers, fundadores de SaaS y pequeñas empresas que necesitan automatización simple.</p><h3>Características:</h3><ul><li>Secuencias generadas por IA</li><li>Configuración mediante wizard simple</li><li>Envío automático basado en delays</li><li>Sin código requerido</li><li>Dashboard para monitoreo</li></ul><p><strong>Menos configuración. Más emails enviados.</strong></p>',
      
      // Toda la configuración va en el campo config (JSON)
      config: JSON.stringify({
        // Metadata
        tagline: 'Email sequences for indie hackers',
        
        // Config técnica
        max_sequences_per_tenant: 10,
        max_emails_per_sequence: 10,
        max_contacts_per_sequence: 10000,
        default_from_name: 'Your Business',
        send_frequency_minutes: 15,
        
        // Preview config
        preview_config: {
          enabled: true,
          route: '/preview/mailflow',
          public_endpoint: '/api/mailflow/preview',
          show_in_store: true,
          demo_button_text: 'Crear secuencia',
          generator_type: 'wizard',
          conversion_config: {
            recovery_key: 'mailflow-onboarding',
            redirect_route: '/mailflow',
            auto_activate: false
          }
        },
        
        // UI config
        ui_config: {
          accent_color: '#6366F1',
          category: 'marketing',
          featured: true,
          homepage_priority: 2,
          tags: ['email', 'automation', 'onboarding', 'marketing', 'saas'],
          screenshots: [],
          demo_video_url: null
        },
        
        // Pricing config (para cuando se valide)
        pricing_config: {
          free_tier: {
            enabled: true,
            sequences: 1,
            contacts_per_sequence: 100,
            emails_per_month: 1000
          },
          paid_tier: {
            price_monthly: 19,
            price_yearly: 190,
            sequences: 'unlimited',
            contacts: 'unlimited',
            emails_per_month: 50000,
            features: [
              'Unlimited sequences',
              'Unlimited contacts',
              'Advanced analytics',
              'Priority support'
            ]
          }
        },
        
        // Sequence templates disponibles
        templates: {
          'saas-onboarding': {
            name: 'SaaS Onboarding',
            description: 'Welcome new users to your SaaS product',
            default_emails: 5,
            suggested_delays: [0, 24, 72, 168, 336]
          },
          'course-welcome': {
            name: 'Course Welcome',
            description: 'Onboard students into your course',
            default_emails: 4,
            suggested_delays: [0, 48, 96, 168]
          },
          'ecommerce-followup': {
            name: 'E-commerce Follow-up',
            description: 'Engage customers after purchase',
            default_emails: 3,
            suggested_delays: [24, 72, 168]
          },
          'lead-nurture': {
            name: 'Lead Nurture',
            description: 'Nurture cold leads into customers',
            default_emails: 6,
            suggested_delays: [0, 48, 96, 168, 336, 504]
          }
        }
      }),
      
      created_at: new Date(),
      updated_at: new Date()
    }], {});
    
    console.log('✅ MailFlow module registered successfully');
  },

  async down(queryInterface, Sequelize) {
    // Eliminar módulo MailFlow
    await queryInterface.bulkDelete('modules', {
      key: 'mailflow'
    }, {});
    
    console.log('✅ MailFlow module removed');
  }
};
