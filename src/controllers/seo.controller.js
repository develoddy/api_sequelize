import SeoConfig from '../models/SeoConfig.js';
import SitemapUrl from '../models/SitemapUrl.js';
import { Product } from '../models/Product.js';
import { Categorie } from '../models/Categorie.js';
import { create } from 'xmlbuilder2';
import googleSearchConsoleService from '../services/googleSearchConsole.service.js';
import { Op } from 'sequelize';

/**
 * 🌐 GENERAR Y SERVIR SITEMAP.XML (Endpoint Público)
 */
export const generateSitemap = async (req, res) => {
    try {
        console.log('📄 [SEO] Generando sitemap.xml...');

        // Obtener configuración
        const config = await SeoConfig.findOne();
        if (!config) {
            return res.status(500).send('Configuración SEO no encontrada');
        }

        const baseUrl = config.sitemapBaseUrl;

        const urls = [];

        // 1️⃣ URLs personalizadas desde la BD (páginas estáticas, custom, etc.)
        // Excluir productos/categorías porque se generan dinámicamente si están habilitados
        const customUrls = await SitemapUrl.findAll({
            where: { 
                enabled: true,
                type: { [Op.in]: ['static', 'custom'] }
            },
            order: [['priority', 'DESC'], ['lastmod', 'DESC']]
        });

        for (const url of customUrls) {
            urls.push({
                loc: url.loc,
                lastmod: url.lastmod ? url.lastmod.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                changefreq: url.changefreq,
                priority: url.priority
            });
        }

        // 2️⃣ Productos sincronizados con Printful (si está habilitado)
        if (config.sitemapIncludeProducts) {
            const products = await Product.findAll({
                where: { 
                    state: 2, // state = 2 means ACTIVE
                    slug: { [Op.ne]: null } 
                },
                attributes: ['id', 'slug', 'updatedAt']
            });

            const cleanBaseUrl = baseUrl.replace(/\/$/, ''); // Remover barra final
            
            // Obtener URLs de productos que están habilitadas en sitemap_urls
            const enabledProductUrls = await SitemapUrl.findAll({
                where: {
                    type: 'product',
                    enabled: true
                },
                attributes: ['loc']
            });
            
            const enabledUrls = new Set(enabledProductUrls.map(u => u.loc));
            
            for (const product of products) {
                const productUrl = `${cleanBaseUrl}/es/es/shop/product/${product.slug}`;
                
                // Solo incluir si la URL está habilitada en sitemap_urls (o no existe aún en sitemap_urls)
                if (!enabledUrls.size || enabledUrls.has(productUrl)) {
                    urls.push({
                        loc: productUrl,
                        lastmod: product.updatedAt.toISOString().split('T')[0],
                        changefreq: config.sitemapProductChangefreq,
                        priority: config.sitemapProductPriority
                    });
                }
            }

            console.log(`✅ [SEO] ${urls.filter(u => u.loc.includes('/shop/product/')).length} productos añadidos al sitemap`);
        }

        // 3️⃣ Categorías (si está habilitado)
        if (config.sitemapIncludeCategories) {
            const categories = await Categorie.findAll({
                where: { 
                    state: 1, // state = 1 means ACTIVE for categories (different from products)
                    title: { [Op.ne]: null }
                },
                attributes: ['id', 'title', 'updatedAt']
            });

            const cleanBaseUrl = baseUrl.replace(/\/$/, ''); // Remover barra final
            
            // Obtener URLs de categorías que están habilitadas en sitemap_urls
            const enabledCategoryUrls = await SitemapUrl.findAll({
                where: {
                    type: 'category',
                    enabled: true
                },
                attributes: ['loc']
            });
            
            const enabledUrls = new Set(enabledCategoryUrls.map(u => u.loc));
            
            for (const category of categories) {
                // Convertir title a slug (reemplazar espacios y caracteres especiales)
                const categorySlug = category.title
                    .toLowerCase()
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '') // Remover acentos
                    .replace(/[^a-z0-9\s-]/g, '') // Remover caracteres especiales
                    .trim()
                    .replace(/\s+/g, '-'); // Reemplazar espacios por guiones

                const categoryUrl = `${cleanBaseUrl}/es/es/shop/category/${categorySlug}`;
                
                // Solo incluir si la URL está habilitada en sitemap_urls (o no existe aún en sitemap_urls)
                if (!enabledUrls.size || enabledUrls.has(categoryUrl)) {
                    urls.push({
                        loc: categoryUrl,
                        lastmod: category.updatedAt.toISOString().split('T')[0],
                        changefreq: 'weekly',
                        priority: 0.7
                    });
                }
            }

            console.log(`✅ [SEO] ${urls.filter(u => u.loc.includes('/shop/category/')).length} categorías añadidas al sitemap`);
        }

        // Construir XML con namespaces correctos
        const doc = create({ version: '1.0', encoding: 'UTF-8' })
            .ele('urlset', {
                'xmlns': 'http://www.sitemaps.org/schemas/sitemap/0.9',
                'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
                'xsi:schemaLocation': 'http://www.sitemaps.org/schemas/sitemap/0.9 http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd'
            });

        urls.forEach(url => {
            const urlElement = doc.ele('url');
            urlElement.ele('loc').txt(url.loc);
            if (url.lastmod) urlElement.ele('lastmod').txt(url.lastmod);
            urlElement.ele('changefreq').txt(url.changefreq);
            urlElement.ele('priority').txt(url.priority.toString());
        });

        const xmlContent = doc.end({ prettyPrint: true });

        // Actualizar última generación
        await config.update({ lastSitemapGeneration: new Date() });

        console.log(`✅ [SEO] Sitemap generado con ${urls.length} URLs`);

        // Servir XML con headers correctos
        res.header('Content-Type', 'application/xml; charset=utf-8');
        // Cache de 5 minutos en desarrollo, puedes subir a 3600 (1 hora) en producción
        const cacheTime = process.env.NODE_ENV === 'production' ? 3600 : 300;
        res.header('Cache-Control', `public, max-age=${cacheTime}`);
        res.send(xmlContent);

    } catch (error) {
        console.error('❌ [SEO] Error generando sitemap:', error);
        res.status(500).send('Error generando sitemap');
    }
};

/**
 * 🤖 GENERAR Y SERVIR ROBOTS.TXT (Endpoint Público)
 */
export const generateRobotsTxt = async (req, res) => {
    try {
        console.log('🤖 [SEO] Generando robots.txt...');

        // Obtener configuración
        const config = await SeoConfig.findOne();
        if (!config) {
            return res.status(500).send('Configuración SEO no encontrada');
        }

        let robotsTxt = '';

        // Si hay contenido personalizado, usarlo
        if (config.robotsTxtContent) {
            robotsTxt = config.robotsTxtContent;
        } 
        // Si no, generar desde reglas estructuradas
        else if (config.robotsRules) {
            const rules = typeof config.robotsRules === 'string' 
                ? JSON.parse(config.robotsRules) 
                : config.robotsRules;

            // Generar robots.txt desde reglas
            if (rules.userAgents && Array.isArray(rules.userAgents)) {
                rules.userAgents.forEach(ua => {
                    robotsTxt += `User-agent: ${ua.agent}\n`;
                    
                    if (ua.allow && Array.isArray(ua.allow)) {
                        ua.allow.forEach(path => {
                            robotsTxt += `Allow: ${path}\n`;
                        });
                    }
                    
                    if (ua.disallow && Array.isArray(ua.disallow)) {
                        ua.disallow.forEach(path => {
                            robotsTxt += `Disallow: ${path}\n`;
                        });
                    }
                    
                    robotsTxt += '\n';
                });
            }

            // Añadir sitemap al final
            if (rules.sitemap) {
                robotsTxt += `Sitemap: ${rules.sitemap}\n`;
            }
        }

        // Actualizar última actualización
        await config.update({ lastRobotsTxtUpdate: new Date() });

        console.log('✅ [SEO] robots.txt generado correctamente');

        // Servir con headers correctos
        res.header('Content-Type', 'text/plain; charset=utf-8');
        res.header('Cache-Control', 'public, max-age=86400'); // Cache de 24 horas
        res.send(robotsTxt);

    } catch (error) {
        console.error('❌ [SEO] Error generando robots.txt:', error);
        res.status(500).send('Error generando robots.txt');
    }
};

/**
 * 📋 OBTENER CONFIGURACIÓN SEO (Admin)
 */
export const getConfig = async (req, res) => {
    try {
        let config = await SeoConfig.findOne();

        // Si no existe, crear configuración por defecto
        if (!config) {
            config = await SeoConfig.create({
                sitemapBaseUrl: 'https://tienda.lujandev.com',
                sitemapIncludeProducts: true,
                sitemapIncludeCategories: true,
                sitemapProductChangefreq: 'weekly',
                sitemapProductPriority: 0.8,
                robotsRules: {
                    userAgents: [
                        {
                            agent: '*',
                            allow: ['/'],
                            disallow: ['/admin', '/api']
                        }
                    ],
                    sitemap: 'https://tienda.lujandev.com/sitemap.xml'
                }
            });
        }

        res.json({
            success: true,
            config: config
        });

    } catch (error) {
        console.error('❌ Error obteniendo configuración SEO:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo configuración SEO'
        });
    }
};

/**
 * 💾 ACTUALIZAR CONFIGURACIÓN SEO (Admin)
 */
export const updateConfig = async (req, res) => {
    try {
        const updates = req.body;
        
        console.log('📝 [SEO] Actualizando configuración con:', JSON.stringify(updates, null, 2));

        let config = await SeoConfig.findOne();
        
        if (!config) {
            config = await SeoConfig.create(updates);
        } else {
            await config.update(updates);
        }

        // Si se actualizaron las reglas de robots, actualizar timestamp
        if (updates.robotsRules || updates.robotsTxtContent) {
            await config.update({ lastRobotsTxtUpdate: new Date() });
        }

        console.log('✅ Configuración SEO actualizada');

        res.json({
            success: true,
            message: 'Configuración actualizada correctamente',
            config: config
        });

    } catch (error) {
        console.error('❌ Error actualizando configuración SEO:', error);
        res.status(500).json({
            success: false,
            message: 'Error actualizando configuración SEO'
        });
    }
};

/**
 * 📃 LISTAR URLs DEL SITEMAP (Admin)
 */
export const listSitemapUrls = async (req, res) => {
    try {
        const { page = 1, limit = 50, type, enabled } = req.query;
        
        const where = {};
        if (type) where.type = type;
        if (enabled !== undefined) where.enabled = enabled === 'true';

        const offset = (parseInt(page) - 1) * parseInt(limit);

        const { count, rows } = await SitemapUrl.findAndCountAll({
            where,
            limit: parseInt(limit),
            offset,
            order: [['priority', 'DESC'], ['lastmod', 'DESC']]
        });

        res.json({
            success: true,
            total: count,
            page: parseInt(page),
            pages: Math.ceil(count / parseInt(limit)),
            urls: rows
        });

    } catch (error) {
        console.error('❌ Error listando URLs del sitemap:', error);
        res.status(500).json({
            success: false,
            message: 'Error listando URLs del sitemap'
        });
    }
};

/**
 * ➕ AÑADIR URL AL SITEMAP (Admin)
 */
export const addSitemapUrl = async (req, res) => {
    try {
        const { loc, changefreq, priority, type, enabled, metadata } = req.body;

        // Validar URL requerida
        if (!loc) {
            return res.status(400).json({
                success: false,
                message: 'La URL (loc) es requerida'
            });
        }

        // Verificar si ya existe
        const existing = await SitemapUrl.findOne({ where: { loc } });
        if (existing) {
            return res.status(409).json({
                success: false,
                message: 'Esta URL ya existe en el sitemap'
            });
        }

        // Crear nueva URL
        const newUrl = await SitemapUrl.create({
            loc,
            lastmod: new Date(),
            changefreq: changefreq || 'weekly',
            priority: priority || 0.5,
            type: type || 'custom',
            enabled: enabled !== undefined ? enabled : true,
            metadata: metadata || null
        });

        console.log(`✅ Nueva URL añadida al sitemap: ${loc}`);

        res.json({
            success: true,
            message: 'URL añadida correctamente al sitemap',
            url: newUrl
        });

    } catch (error) {
        console.error('❌ Error añadiendo URL al sitemap:', error);
        res.status(500).json({
            success: false,
            message: 'Error añadiendo URL al sitemap'
        });
    }
};

/**
 * ✏️ ACTUALIZAR URL DEL SITEMAP (Admin)
 */
export const updateSitemapUrl = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const url = await SitemapUrl.findByPk(id);
        if (!url) {
            return res.status(404).json({
                success: false,
                message: 'URL no encontrada'
            });
        }

        // Actualizar lastmod automáticamente
        updates.lastmod = new Date();

        await url.update(updates);

        console.log(`✅ URL actualizada en el sitemap: ${url.loc}`);

        res.json({
            success: true,
            message: 'URL actualizada correctamente',
            url: url
        });

    } catch (error) {
        console.error('❌ Error actualizando URL del sitemap:', error);
        res.status(500).json({
            success: false,
            message: 'Error actualizando URL del sitemap'
        });
    }
};

/**
 * ❌ ELIMINAR URL DEL SITEMAP (Admin)
 */
export const deleteSitemapUrl = async (req, res) => {
    try {
        const { id } = req.params;

        const url = await SitemapUrl.findByPk(id);
        if (!url) {
            return res.status(404).json({
                success: false,
                message: 'URL no encontrada'
            });
        }

        const deletedLoc = url.loc;
        await url.destroy();

        console.log(`✅ URL eliminada del sitemap: ${deletedLoc}`);

        res.json({
            success: true,
            message: 'URL eliminada correctamente'
        });

    } catch (error) {
        console.error('❌ Error eliminando URL del sitemap:', error);
        res.status(500).json({
            success: false,
            message: 'Error eliminando URL del sitemap'
        });
    }
};

/**
 * 🔄 SINCRONIZAR PRODUCTOS CON SITEMAP (Admin)
 * Actualiza URLs de productos en el sitemap según estado en BD
 */
export const syncProductsToSitemap = async (req, res) => {
    try {
        console.log('🔄 [SEO] Sincronizando productos con sitemap...');

        const config = await SeoConfig.findOne();
        if (!config) {
            return res.status(500).json({
                success: false,
                message: 'Configuración SEO no encontrada'
            });
        }

        const baseUrl = config.sitemapBaseUrl;

        // Obtener todos los productos activos
        const products = await Product.findAll({
            where: { 
                state: 2, // state = 2 means ACTIVE
                slug: { [Op.ne]: null }
            },
            attributes: ['id', 'slug', 'updatedAt']
        });

        let added = 0;
        let updated = 0;

        for (const product of products) {
            // Asegurar que no haya doble barra en la URL
            const cleanBaseUrl = baseUrl.replace(/\/$/, ''); // Remover barra final si existe
            const loc = `${cleanBaseUrl}/es/es/shop/product/${product.slug}`;
            
            const [url, created] = await SitemapUrl.findOrCreate({
                where: { loc },
                defaults: {
                    lastmod: product.updatedAt,
                    changefreq: config.sitemapProductChangefreq,
                    priority: config.sitemapProductPriority,
                    type: 'product',
                    enabled: true,
                    metadata: { productId: product.id }
                }
            });

            if (created) {
                added++;
            } else {
                await url.update({
                    lastmod: product.updatedAt,
                    enabled: true
                });
                updated++;
            }
        }

        // Deshabilitar productos que ya no existen o están inactivos
        const allProductUrls = await SitemapUrl.findAll({
            where: { type: 'product', enabled: true }
        });

        const cleanBaseUrl = baseUrl.replace(/\/$/, ''); // Remover barra final si existe
        const activeProductSlugs = products.map(p => `${cleanBaseUrl}/es/es/shop/product/${p.slug}`);
        let disabled = 0;

        for (const url of allProductUrls) {
            if (!activeProductSlugs.includes(url.loc)) {
                await url.update({ enabled: false });
                disabled++;
            }
        }

        console.log(`✅ [SEO] Sincronización completa: ${added} añadidos, ${updated} actualizados, ${disabled} deshabilitados`);

        // 🔄 También sincronizar categorías automáticamente
        console.log('🔄 [SEO] Sincronizando categorías...');
        
        const categories = await Categorie.findAll({
            where: { 
                state: 1, // state = 1 means ACTIVE for categories (different from products)
                title: { [Op.ne]: null }
            },
            attributes: ['id', 'title', 'updatedAt']
        });

        let catAdded = 0;
        let catUpdated = 0;

        for (const category of categories) {
            const categorySlug = category.title
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9\s-]/g, '')
                .trim()
                .replace(/\s+/g, '-');

            const cleanBaseUrl = baseUrl.replace(/\/$/, '');
            const loc = `${cleanBaseUrl}/es/es/shop/category/${categorySlug}`;
            
            const [url, created] = await SitemapUrl.findOrCreate({
                where: { loc },
                defaults: {
                    lastmod: category.updatedAt,
                    changefreq: 'weekly',
                    priority: 0.7,
                    type: 'category',
                    enabled: true,
                    metadata: { categoryId: category.id }
                }
            });

            if (created) {
                catAdded++;
            } else {
                await url.update({
                    lastmod: category.updatedAt,
                    enabled: true
                });
                catUpdated++;
            }
        }

        console.log(`✅ [SEO] Categorías sincronizadas: ${catAdded} añadidas, ${catUpdated} actualizadas`);

        res.json({
            success: true,
            message: 'Productos y categorías sincronizados correctamente',
            stats: {
                products: {
                    added,
                    updated,
                    disabled,
                    total: products.length
                },
                categories: {
                    added: catAdded,
                    updated: catUpdated,
                    total: categories.length
                }
            }
        });

    } catch (error) {
        console.error('❌ Error sincronizando productos:', error);
        res.status(500).json({
            success: false,
            message: 'Error sincronizando productos con sitemap'
        });
    }
};

/**
 * 📤 NOTIFICAR A GOOGLE SEARCH CONSOLE (Admin)
 */
export const notifyGoogle = async (req, res) => {
    try {
        console.log('📤 [SEO] Notificando a Google Search Console...');

        const config = await SeoConfig.findOne();
        if (!config) {
            return res.status(404).json({
                success: false,
                message: 'Configuración SEO no encontrada'
            });
        }

        if (!config.googleSearchConsoleEnabled) {
            return res.status(400).json({
                success: false,
                message: 'La integración con Google Search Console no está habilitada'
            });
        }

        if (!config.googleSearchConsoleApiKey) {
            return res.status(400).json({
                success: false,
                message: 'No se ha configurado la API Key de Google Search Console'
            });
        }

        // Inicializar servicio de Google
        await googleSearchConsoleService.initialize(config.googleSearchConsoleApiKey);

        const siteUrl = config.googleSearchConsoleSiteUrl || config.sitemapBaseUrl;
        const sitemapUrl = `${config.sitemapBaseUrl}/sitemap.xml`;

        // Enviar sitemap a Google
        const result = await googleSearchConsoleService.submitSitemap(siteUrl, sitemapUrl);

        // Actualizar timestamp de última notificación
        await config.update({ lastGoogleNotification: new Date() });

        console.log('✅ [SEO] Google Search Console notificado correctamente');

        res.json({
            success: true,
            message: 'Sitemap enviado correctamente a Google Search Console',
            data: result
        });

    } catch (error) {
        console.error('❌ Error notificando a Google:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error enviando sitemap a Google'
        });
    }
};

/**
 * 📊 OBTENER ESTADÍSTICAS DEL SITEMAP (Admin)
 */
export const getSitemapStats = async (req, res) => {
    try {
        const config = await SeoConfig.findOne();

        // Contar URLs por tipo
        const stats = {
            total: await SitemapUrl.count({ where: { enabled: true } }),
            byType: {
                static: await SitemapUrl.count({ where: { type: 'static', enabled: true } }),
                product: await SitemapUrl.count({ where: { type: 'product', enabled: true } }),
                category: await SitemapUrl.count({ where: { type: 'category', enabled: true } }),
                custom: await SitemapUrl.count({ where: { type: 'custom', enabled: true } })
            },
            disabled: await SitemapUrl.count({ where: { enabled: false } }),
            lastGeneration: config ? config.lastSitemapGeneration : null,
            lastRobotsUpdate: config ? config.lastRobotsTxtUpdate : null,
            lastGoogleNotification: config ? config.lastGoogleNotification : null
        };

        res.json({
            success: true,
            stats
        });

    } catch (error) {
        console.error('❌ Error obteniendo estadísticas:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo estadísticas del sitemap'
        });
    }
};
