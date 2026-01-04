'use strict';

/**
 * Seeder: Initial modules
 * 
 * Módulos iniciales:
 * 1. Printful (ACTIVO - ya está funcionando)
 * 2. Digital Products (DRAFT - próximo experimento)
 * 3. Dev Consulting (DRAFT - idea futura)
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();
    const printfulLaunchDate = new Date('2024-12-01');
    const printfulValidatedDate = new Date('2024-12-15');

    // Verificar si ya existen módulos
    const [existingModules] = await queryInterface.sequelize.query(
      'SELECT `key` FROM modules WHERE `key` IN (?, ?, ?, ?)',
      {
        replacements: ['printful', 'digital-products', 'dev-consulting', 'build-in-public-course']
      }
    );

    const existingKeys = existingModules.map(m => m.key);

    // Solo insertar módulos que NO existan
    const modulesToInsert = [
      {
        // 1. PRINTFUL - Módulo activo y validado
        key: 'printful',
        name: 'Printful POD',
        description: 'Print on Demand con Printful - Camisetas, mugs, hoodies y más',
        type: 'physical',
        is_active: true,
        status: 'live',
        validation_days: 14,
        validation_target_sales: 1,
        launched_at: printfulLaunchDate,
        validated_at: printfulValidatedDate,
        config: JSON.stringify({
          provider: 'printful',
          webhook_url: 'https://api.lujandev.com/printful-webhook/webhook',
          auto_sync: true,
          categories: ['t-shirts', 'mugs', 'hoodies', 'caps'],
          sync_enabled: true,
          stock_alerts: true
        }),
        icon: 'fa-print',
        color: 'primary',
        base_price: null,
        currency: 'EUR',
        total_sales: 0,
        total_revenue: 0.00,
        total_orders: 0,
        last_sale_at: null,
        created_at: now,
        updated_at: now
      },
      {
        // 2. DIGITAL PRODUCTS - Próximo experimento
        key: 'digital-products',
        name: 'Digital Products',
        description: 'Venta de productos digitales descargables (ebooks, templates, recursos)',
        type: 'digital',
        is_active: false,
        status: 'draft',
        validation_days: 7,
        validation_target_sales: 3,
        launched_at: null,
        validated_at: null,
        config: JSON.stringify({
          max_file_size_mb: 100,
          allowed_formats: ['pdf', 'zip', 'psd', 'fig', 'sketch'],
          delivery_method: 'email',
          download_limit: 3,
          expiry_days: 30
        }),
        icon: 'fa-download',
        color: 'success',
        base_price: 19.00,
        currency: 'EUR',
        total_sales: 0,
        total_revenue: 0.00,
        total_orders: 0,
        last_sale_at: null,
        created_at: now,
        updated_at: now
      },
      {
        // 3. DEV CONSULTING - Idea futura
        key: 'dev-consulting',
        name: 'Dev Consulting 1-on-1',
        description: 'Consultoría personalizada para developers e indie hackers',
        type: 'service',
        is_active: false,
        status: 'draft',
        validation_days: 14,
        validation_target_sales: 2,
        launched_at: null,
        validated_at: null,
        config: JSON.stringify({
          duration_minutes: 60,
          calendar_integration: 'calendly',
          payment_upfront: true,
          timezone: 'Europe/Madrid',
          available_slots: ['morning', 'afternoon']
        }),
        icon: 'fa-user-tie',
        color: 'warning',
        base_price: 99.00,
        currency: 'EUR',
        total_sales: 0,
        total_revenue: 0.00,
        total_orders: 0,
        last_sale_at: null,
        created_at: now,
        updated_at: now
      },
      {
        // 4. BUILD IN PUBLIC COURSE - Idea futura
        key: 'build-in-public-course',
        name: 'Build in Public Course',
        description: 'Curso completo sobre cómo construir y monetizar productos públicamente',
        type: 'digital',
        is_active: false,
        status: 'draft',
        validation_days: 14,
        validation_target_sales: 5,
        launched_at: null,
        validated_at: null,
        config: JSON.stringify({
          format: 'video',
          modules: 10,
          duration_hours: 8,
          access_type: 'lifetime',
          includes: ['videos', 'templates', 'community']
        }),
        icon: 'fa-graduation-cap',
        color: 'info',
        base_price: 149.00,
        currency: 'EUR',
        total_sales: 0,
        total_revenue: 0.00,
        total_orders: 0,
        last_sale_at: null,
        created_at: now,
        updated_at: now
      }
    ];

    // Filtrar solo los módulos que no existen
    const newModules = modulesToInsert.filter(m => !existingKeys.includes(m.key));

    if (newModules.length === 0) {
      console.log('ℹ️  Todos los módulos ya existen, saltando inserción');
      return;
    }

    // Insertar solo los nuevos
    await queryInterface.bulkInsert('modules', newModules);

    console.log('✅ Módulos iniciales creados:');
    if (!existingKeys.includes('printful')) {
      console.log('   🟢 Printful POD (LIVE - Validado)');
    }
    if (!existingKeys.includes('digital-products')) {
      console.log('   ⚪ Digital Products (DRAFT)');
    }
    if (!existingKeys.includes('dev-consulting')) {
      console.log('   ⚪ Dev Consulting (DRAFT)');
    }
    if (!existingKeys.includes('build-in-public-course')) {
      console.log('   ⚪ Build in Public Course (DRAFT)');
    }
    
    if (existingKeys.length > 0) {
      console.log('\nℹ️  Módulos ya existentes (saltados):');
      existingKeys.forEach(key => console.log('   ⏭️  ' + key));
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('modules', {
      key: ['printful', 'digital-products', 'dev-consulting', 'build-in-public-course']
    }, {});
    
    console.log('✅ Módulos eliminados');
  }
};
