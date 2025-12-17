import express from 'express';
import * as seoController from '../controllers/seo.controller.js';
import auth from '../middlewares/auth.js'; // Middleware de autenticación admin

const router = express.Router();

// ==========================================
// 🌐 RUTAS PÚBLICAS (Sin autenticación)
// ==========================================

/**
 * GET /sitemap.xml
 * Generar y servir sitemap.xml dinámicamente
 */
router.get('/sitemap.xml', seoController.generateSitemap);

/**
 * GET /robots.txt
 * Generar y servir robots.txt dinámicamente
 */
router.get('/robots.txt', seoController.generateRobotsTxt);

// ==========================================
// 🔐 RUTAS DE ADMINISTRACIÓN (Requieren autenticación)
// ==========================================

/**
 * GET /api/admin/seo/config
 * Obtener configuración SEO actual
 */
router.get('/admin/seo/config', auth.verifyAdmin, seoController.getConfig);

/**
 * PUT /api/admin/seo/config
 * Actualizar configuración SEO
 */
router.put('/admin/seo/config', auth.verifyAdmin, seoController.updateConfig);

/**
 * GET /api/admin/seo/sitemap-urls
 * Listar todas las URLs del sitemap con paginación
 * Query params: page, limit, type, enabled
 */
router.get('/admin/seo/sitemap-urls', auth.verifyAdmin, seoController.listSitemapUrls);

/**
 * POST /api/admin/seo/sitemap-urls
 * Añadir una nueva URL al sitemap
 */
router.post('/admin/seo/sitemap-urls', auth.verifyAdmin, seoController.addSitemapUrl);

/**
 * PUT /api/admin/seo/sitemap-urls/:id
 * Actualizar una URL existente del sitemap
 */
router.put('/admin/seo/sitemap-urls/:id', auth.verifyAdmin, seoController.updateSitemapUrl);

/**
 * DELETE /api/admin/seo/sitemap-urls/:id
 * Eliminar una URL del sitemap
 */
router.delete('/admin/seo/sitemap-urls/:id', auth.verifyAdmin, seoController.deleteSitemapUrl);

/**
 * POST /api/admin/seo/sync-products
 * Sincronizar productos activos con el sitemap
 */
router.post('/admin/seo/sync-products', auth.verifyAdmin, seoController.syncProductsToSitemap);

/**
 * POST /api/admin/seo/notify-google
 * Enviar notificación de actualización a Google Search Console
 */
router.post('/admin/seo/notify-google', auth.verifyAdmin, seoController.notifyGoogle);

/**
 * GET /api/admin/seo/stats
 * Obtener estadísticas del sitemap
 */
router.get('/admin/seo/stats', auth.verifyAdmin, seoController.getSitemapStats);

export default router;
