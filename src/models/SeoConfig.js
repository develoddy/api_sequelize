import { DataTypes } from 'sequelize';
import { sequelize } from '../database/database.js';

const SeoConfig = sequelize.define('seo_configs', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    // Configuración de Robots.txt
    robotsTxtContent: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'robots_txt_content',
        comment: 'Contenido completo del robots.txt'
    },
    robotsRules: {
        type: DataTypes.JSON,
        allowNull: true,
        field: 'robots_rules',
        defaultValue: {
            userAgents: [
                {
                    agent: '*',
                    allow: ['/'],
                    disallow: ['/admin', '/api'],
                }
            ],
            sitemap: 'https://tienda.lujandev.com/sitemap.xml'
        },
        comment: 'Reglas estructuradas para generar robots.txt'
    },
    
    // Configuración de Sitemap
    sitemapBaseUrl: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: 'sitemap_base_url',
        defaultValue: 'https://tienda.lujandev.com',
        comment: 'URL base del sitio para el sitemap'
    },
    sitemapIncludeProducts: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        field: 'sitemap_include_products',
        defaultValue: true,
        comment: 'Incluir productos en el sitemap'
    },
    sitemapIncludeCategories: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        field: 'sitemap_include_categories',
        defaultValue: true,
        comment: 'Incluir categorías en el sitemap'
    },
    sitemapProductChangefreq: {
        type: DataTypes.ENUM('always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never'),
        allowNull: false,
        field: 'sitemap_product_changefreq',
        defaultValue: 'weekly',
        comment: 'Frecuencia de cambio para productos'
    },
    sitemapProductPriority: {
        type: DataTypes.DECIMAL(2, 1),
        allowNull: false,
        field: 'sitemap_product_priority',
        defaultValue: 0.8,
        comment: 'Prioridad para productos (0.0 - 1.0)'
    },
    
    // Google Search Console
    googleSearchConsoleEnabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        field: 'google_search_console_enabled',
        defaultValue: false,
        comment: 'Habilitar notificaciones automáticas a GSC'
    },
    googleSearchConsoleApiKey: {
        type: DataTypes.STRING(500),
        allowNull: true,
        field: 'google_search_console_api_key',
        comment: 'API Key de Google Search Console (JSON)'
    },
    googleSearchConsoleSiteUrl: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'google_search_console_site_url',
        comment: 'URL del sitio verificado en GSC'
    },
    
    // Metadata general
    lastSitemapGeneration: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'last_sitemap_generation',
        comment: 'Última vez que se generó el sitemap'
    },
    lastRobotsTxtUpdate: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'last_robots_txt_update',
        comment: 'Última actualización del robots.txt'
    },
    lastGoogleNotification: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'last_google_notification',
        comment: 'Última notificación enviada a Google'
    },
    
    // Control de versiones
    version: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
        comment: 'Versión de la configuración'
    },
    
    createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'created_at'
    },
    updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'updated_at'
    }
}, {
    tableName: 'seo_configs',
    timestamps: true,
    underscored: true,
    indexes: [
        {
            unique: false,
            fields: ['last_sitemap_generation']
        }
    ]
});

export default SeoConfig;
