'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const isDevelopment = process.env.NODE_ENV !== 'production';
    
    // Verificar si las tablas ya existen
    const tables = await queryInterface.showAllTables();
    const seoConfigExists = tables.includes('seo_configs');
    const sitemapUrlsExists = tables.includes('sitemap_urls');
    
    // Crear tabla seo_configs solo si no existe
    if (!seoConfigExists) {
      await queryInterface.createTable('seo_configs', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        robots_txt_content: {
          type: Sequelize.TEXT,
          allowNull: true,
          comment: 'Contenido completo del robots.txt'
        },
        robots_rules: {
          type: Sequelize.JSON,
          allowNull: true,
          comment: 'Reglas estructuradas para generar robots.txt'
        },
        sitemap_base_url: {
          type: Sequelize.STRING(255),
          allowNull: false,
          defaultValue: 'https://tienda.lujandev.com',
          comment: 'URL base del sitio para el sitemap'
        },
        sitemap_include_products: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true,
          comment: 'Incluir productos en el sitemap'
        },
        sitemap_include_categories: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true,
          comment: 'Incluir categorías en el sitemap'
        },
        sitemap_product_changefreq: {
          type: Sequelize.ENUM('always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never'),
          allowNull: false,
          defaultValue: 'weekly',
          comment: 'Frecuencia de cambio para productos'
        },
        sitemap_product_priority: {
          type: Sequelize.DECIMAL(2, 1),
          allowNull: false,
          defaultValue: 0.8,
          comment: 'Prioridad para productos (0.0 - 1.0)'
        },
        google_search_console_enabled: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
          comment: 'Habilitar notificaciones automáticas a GSC'
        },
        google_search_console_api_key: {
          type: Sequelize.STRING(500),
          allowNull: true,
          comment: 'API Key de Google Search Console (JSON)'
        },
        google_search_console_site_url: {
          type: Sequelize.STRING(255),
          allowNull: true,
          comment: 'URL del sitio verificado en GSC'
        },
        last_sitemap_generation: {
          type: Sequelize.DATE,
          allowNull: true,
          comment: 'Última vez que se generó el sitemap'
        },
        last_robots_txt_update: {
          type: Sequelize.DATE,
          allowNull: true,
          comment: 'Última actualización del robots.txt'
        },
        last_google_notification: {
          type: Sequelize.DATE,
          allowNull: true,
          comment: 'Última notificación enviada a Google'
        },
        version: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 1,
          comment: 'Versión de la configuración'
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
        }
      });
    }

    // Crear tabla sitemap_urls solo si no existe
    if (!sitemapUrlsExists) {
      await queryInterface.createTable('sitemap_urls', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        loc: {
          type: Sequelize.STRING(500),
          allowNull: false,
          comment: 'URL completa de la página'
        },
        lastmod: {
          type: Sequelize.DATE,
          allowNull: true,
          comment: 'Fecha de última modificación'
        },
        changefreq: {
          type: Sequelize.ENUM('always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never'),
          allowNull: false,
          defaultValue: 'weekly',
          comment: 'Frecuencia de cambio'
        },
        priority: {
          type: Sequelize.DECIMAL(2, 1),
          allowNull: false,
          defaultValue: 0.5,
          comment: 'Prioridad (0.0 - 1.0)'
        },
        type: {
          type: Sequelize.ENUM('static', 'product', 'category', 'custom'),
          allowNull: false,
          defaultValue: 'custom',
          comment: 'Tipo de URL'
        },
        enabled: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true,
          comment: 'URL activa en el sitemap'
        },
        metadata: {
          type: Sequelize.JSON,
          allowNull: true,
          comment: 'Metadata adicional (productId, categoryId, etc.)'
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
        }
      });
    }

    // Crear índices solo si las tablas son nuevas
    if (!seoConfigExists) {
      try {
        await queryInterface.addIndex('seo_configs', ['last_sitemap_generation']);
      } catch (error) {
        console.log('⚠️  Índice seo_configs_last_sitemap_generation ya existe, continuando...');
      }
    }

    if (!sitemapUrlsExists) {
      try {
        await queryInterface.addIndex('sitemap_urls', ['loc'], {
          unique: true,
          name: 'sitemap_urls_loc_unique'
        });
      } catch (error) {
        console.log('⚠️  Índice sitemap_urls_loc_unique ya existe, continuando...');
      }

      try {
        await queryInterface.addIndex('sitemap_urls', ['type']);
      } catch (error) {
        console.log('⚠️  Índice sitemap_urls_type ya existe, continuando...');
      }

      try {
        await queryInterface.addIndex('sitemap_urls', ['enabled']);
      } catch (error) {
        console.log('⚠️  Índice sitemap_urls_enabled ya existe, continuando...');
      }

      try {
        await queryInterface.addIndex('sitemap_urls', ['lastmod']);
      } catch (error) {
        console.log('⚠️  Índice sitemap_urls_lastmod ya existe, continuando...');
      }
    }

    // Insertar configuración por defecto solo si la tabla es nueva
    if (!seoConfigExists) {
      const sitemapUrl = isDevelopment 
        ? 'http://127.0.0.1:3500/api/sitemap.xml'
        : 'https://api.lujandev.com/sitemap.xml';
      
      const baseUrl = isDevelopment
        ? 'http://localhost:5000'
        : 'https://tienda.lujandev.com';

      await queryInterface.bulkInsert('seo_configs', [{
        robots_txt_content: null,
        robots_rules: JSON.stringify({
          userAgents: [
            {
              agent: '*',
              allow: ['/'],
              disallow: ['/admin', '/api']
            }
          ],
          sitemap: sitemapUrl
        }),
        sitemap_base_url: baseUrl,
        sitemap_include_products: true,
        sitemap_include_categories: true,
        sitemap_product_changefreq: 'weekly',
        sitemap_product_priority: 0.8,
        google_search_console_enabled: false,
        version: 1,
        created_at: new Date(),
        updated_at: new Date()
      }]);
    }

    // Insertar URLs estáticas por defecto solo si la tabla es nueva
    if (!sitemapUrlsExists) {
      const baseUrl = isDevelopment
        ? 'http://localhost:5000'
        : 'https://tienda.lujandev.com';

      await queryInterface.bulkInsert('sitemap_urls', [
        {
          loc: `${baseUrl}/es/es/home`,
          lastmod: new Date(),
          changefreq: 'daily',
          priority: 1.0,
          type: 'static',
          enabled: true,
          metadata: JSON.stringify({ page: 'home' }),
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          loc: `${baseUrl}/es/es/shop/filter-products`,
          lastmod: new Date(),
          changefreq: 'daily',
          priority: 0.9,
          type: 'static',
          enabled: true,
          metadata: JSON.stringify({ page: 'shop' }),
          created_at: new Date(),
          updated_at: new Date()
        }
      ]);
    }

    console.log('✅ Migración SEO completada');
  },

  async down (queryInterface, Sequelize) {
    // Eliminar índices primero
    await queryInterface.removeIndex('sitemap_urls', 'sitemap_urls_loc_unique');
    await queryInterface.removeIndex('sitemap_urls', ['type']);
    await queryInterface.removeIndex('sitemap_urls', ['enabled']);
    await queryInterface.removeIndex('sitemap_urls', ['lastmod']);
    await queryInterface.removeIndex('seo_configs', ['last_sitemap_generation']);

    // Eliminar tablas
    await queryInterface.dropTable('sitemap_urls');
    await queryInterface.dropTable('seo_configs');
  }
};
