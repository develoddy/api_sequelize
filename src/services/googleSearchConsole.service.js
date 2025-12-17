import { google } from 'googleapis';

/**
 * Servicio para interactuar con Google Search Console API
 */
class GoogleSearchConsoleService {
    constructor() {
        this.auth = null;
        this.searchConsole = null;
    }

    /**
     * Inicializar autenticación con Google
     * @param {string} apiKeyJson - JSON string con las credenciales de servicio
     */
    async initialize(apiKeyJson) {
        try {
            const credentials = JSON.parse(apiKeyJson);
            
            this.auth = new google.auth.GoogleAuth({
                credentials: credentials,
                scopes: ['https://www.googleapis.com/auth/webmasters']
            });

            this.searchConsole = google.searchconsole({
                version: 'v1',
                auth: this.auth
            });

            console.log('✅ Google Search Console API inicializada correctamente');
            return true;
        } catch (error) {
            console.error('❌ Error inicializando Google Search Console API:', error);
            throw new Error('No se pudo inicializar Google Search Console API');
        }
    }

    /**
     * Enviar notificación de actualización de sitemap a Google
     * @param {string} siteUrl - URL del sitio (ej: https://tienda.lujandev.com)
     * @param {string} sitemapUrl - URL completa del sitemap
     */
    async submitSitemap(siteUrl, sitemapUrl) {
        if (!this.searchConsole) {
            throw new Error('Google Search Console API no está inicializada');
        }

        try {
            console.log(`📤 Enviando sitemap a Google Search Console: ${sitemapUrl}`);
            
            const response = await this.searchConsole.sitemaps.submit({
                siteUrl: siteUrl,
                feedpath: sitemapUrl
            });

            console.log('✅ Sitemap enviado exitosamente a Google Search Console');
            return {
                success: true,
                message: 'Sitemap enviado correctamente a Google',
                data: response.data
            };
        } catch (error) {
            console.error('❌ Error enviando sitemap a Google:', error);
            
            // Manejar errores comunes
            if (error.code === 403) {
                throw new Error('No tienes permisos para este sitio en Google Search Console');
            } else if (error.code === 404) {
                throw new Error('Sitio no encontrado en Google Search Console');
            }
            
            throw new Error(`Error enviando sitemap: ${error.message}`);
        }
    }

    /**
     * Listar sitemaps existentes en Google Search Console
     * @param {string} siteUrl - URL del sitio
     */
    async listSitemaps(siteUrl) {
        if (!this.searchConsole) {
            throw new Error('Google Search Console API no está inicializada');
        }

        try {
            const response = await this.searchConsole.sitemaps.list({
                siteUrl: siteUrl
            });

            return response.data.sitemap || [];
        } catch (error) {
            console.error('❌ Error listando sitemaps:', error);
            throw new Error(`Error listando sitemaps: ${error.message}`);
        }
    }

    /**
     * Eliminar sitemap de Google Search Console
     * @param {string} siteUrl - URL del sitio
     * @param {string} sitemapUrl - URL del sitemap a eliminar
     */
    async deleteSitemap(siteUrl, sitemapUrl) {
        if (!this.searchConsole) {
            throw new Error('Google Search Console API no está inicializada');
        }

        try {
            await this.searchConsole.sitemaps.delete({
                siteUrl: siteUrl,
                feedpath: sitemapUrl
            });

            console.log('✅ Sitemap eliminado de Google Search Console');
            return { success: true, message: 'Sitemap eliminado correctamente' };
        } catch (error) {
            console.error('❌ Error eliminando sitemap:', error);
            throw new Error(`Error eliminando sitemap: ${error.message}`);
        }
    }

    /**
     * Obtener estadísticas de un sitemap
     * @param {string} siteUrl - URL del sitio
     * @param {string} sitemapUrl - URL del sitemap
     */
    async getSitemapStats(siteUrl, sitemapUrl) {
        if (!this.searchConsole) {
            throw new Error('Google Search Console API no está inicializada');
        }

        try {
            const response = await this.searchConsole.sitemaps.get({
                siteUrl: siteUrl,
                feedpath: sitemapUrl
            });

            return response.data;
        } catch (error) {
            console.error('❌ Error obteniendo estadísticas del sitemap:', error);
            throw new Error(`Error obteniendo estadísticas: ${error.message}`);
        }
    }
}

// Exportar instancia singleton
const googleSearchConsoleService = new GoogleSearchConsoleService();
export default googleSearchConsoleService;
