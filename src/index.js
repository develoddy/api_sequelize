/**
 * ================================================================
 * 🔐 BACKEND INDEX.JS — GUÍA COMPLETA PARA DESARROLLO Y PRODUCCIÓN
 * ================================================================
 *
 * Este archivo es el punto de entrada principal del backend.
 * Aquí se controla:
 *   - Conexión a la base de datos (Sequelize)
 *   - Sincronización o NO sincronización de modelos
 *   - Arranque del servidor Express
 *   - Arranque de Socket.IO (chat y notificaciones)
 *   - 🔒 DESACTIVACIÓN DE LOGS EN PRODUCCIÓN (Seguridad)
 *
 * ----------------------------------------------------------------
 * 🧩 DIFERENCIAS ENTRE DEVELOPMENT vs PRODUCTION
 * ----------------------------------------------------------------
 * El backend detecta si estás en producción según:
 * 
 *      NODE_ENV !== "production"
 *
 * Si NO es producción → modo DESARROLLO
 * Si es producción → modo PRODUCCIÓN
 *
 * ----------------------------------------------------------------
 * 🔒 SEGURIDAD: DESACTIVACIÓN DE LOGS EN PRODUCCIÓN
 * ----------------------------------------------------------------
 * En producción, todos los console.log se desactivan automáticamente
 * para prevenir exposición de información sensible.
 * 
 * Solo console.error y console.warn permanecen activos para monitoreo.
 *
 * ----------------------------------------------------------------
 * 🧪 1) MODO DESARROLLO (local)
 * ----------------------------------------------------------------
 * En desarrollo se usa:
 *
 *      sequelize.sync({ alter: true })
 *
 * Esto hace que Sequelize:
 *   ✔ Ajuste columnas automáticamente si cambias modelos
 *   ✔ Cree tablas automáticamente
 *   ✔ NO borra datos (seguro)
 *   ✔ NO requiere migraciones
 *
 * ⚠️ ATENCIÓN:
 * - NO usar force:true (¡BORRA TODA LA DB!)
 * - alter:true es seguro en desarrollo y suficiente para trabajar rápido
 * - NUNCA usar sync en producción
 *
 * ----------------------------------------------------------------
 * 🚀 2) MODO PRODUCCIÓN (servidor real)
 * ----------------------------------------------------------------
 * EN PRODUCCIÓN EL CÓDIGO SOLO HARÁ:
 *
 *      sequelize.authenticate()
 *
 * Es decir:
 *   - Verifica conexión
 *   - NO crea tablas
 *   - NO altera tablas
 *   - NO borra nada
 *
 * ⚠️ IMPORTANTE (PASO OBLIGATORIO)
 * En producción, los cambios en la base de datos se aplican SIEMPRE mediante:
 *
 *      npx sequelize-cli db:migrate
 *
 * Esto significa:
 *   ✔ Todas las modificaciones se hacen con migraciones
 *   ✔ Producción nunca toca sync, ni alter, ni force
 *   ✔ Cero riesgo de borrar ventas o pedidos
 *
 * ----------------------------------------------------------------
 * 📦 FLUJO CORRECTO PARA TRABAJAR
 * ----------------------------------------------------------------
 *
 * 1️⃣ DESARROLLO (local)
 *   - Editas tus modelos
 *   - sync({ alter:true }) aplica cambios automáticamente
 *   - No haces migraciones todavía (opcional)
 *
 * 2️⃣ ANTES DE SUBIR A PRODUCCIÓN
 *   - Creas migraciones:
 *        npx sequelize-cli migration:generate --name nombre
 *   - Exportas modelos actualizados
 *
 * 3️⃣ PRODUCCIÓN (servidor)
 *   - No se ejecuta ningún sync
 *   - Ejecutas:
 *        npx sequelize-cli db:migrate
 *   - Listo, backend SAFE
 *
 * ----------------------------------------------------------------
 * ⚡ QUÉ HACE ESTE index.js
 * ----------------------------------------------------------------
 * ✔ Carga variables .env
 * ✔ Importa todos los modelos para registrar asociaciones
 * ✔ Detecta entorno (dev / production)
 * ✔ En desarrollo → sync({ alter:true })
 * ✔ En producción → authenticate() solamente
 * ✔ Inicia el servidor Express
 * ✔ Habilita Socket.IO
 * ✔ Configura chat y notificaciones en tiempo real
 *
 * ----------------------------------------------------------------
 * 🛑 RESUMEN GENERAL (MUY IMPORTANTE)
 * ----------------------------------------------------------------
 * ✔ sync({ alter:true }) → ÚNICAMENTE en desarrollo
 * ✔ sync({ force:true }) → PROHIBIDO siempre
 * ✔ En producción JAMÁS usar sync
 * ✔ En producción TODO se hace con migraciones
 * ✔ Este index.js es 100% seguro para ecommerce real
 *
 * ================================================================
 */

// -------------------------------
//   INDEX.JS — BACKEND PRINCIPAL
// -------------------------------

// ⚠️ IMPORTANTE: Cargar variables de entorno ANTES que cualquier otro módulo
import './config/env.js';

// ================================================================
// 📝 SISTEMA DE LOGGING A ARCHIVO (para debugging de Stripe y otros)
// ================================================================
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logFilePath = path.join(__dirname, '../logs/server.log');

// Crear directorio logs si no existe
const logsDir = path.dirname(logFilePath);
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Función helper para escribir a archivo
const writeToLogFile = (level, ...args) => {
    const timestamp = new Date().toISOString();
    const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ');
    const logLine = `[${timestamp}] [${level}] ${message}\n`;
    
    fs.appendFile(logFilePath, logLine, (err) => {
        if (err && level !== 'LOG') { // Evitar loop infinito
            console.error('Error writing to log file:', err);
        }
    });
};

// Interceptar console.log, console.error, console.warn
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

console.log = function(...args) {
    originalLog.apply(console, args);
    writeToLogFile('LOG', ...args);
};

console.error = function(...args) {
    originalError.apply(console, args);
    writeToLogFile('ERROR', ...args);
};

console.warn = function(...args) {
    originalWarn.apply(console, args);
    writeToLogFile('WARN', ...args);
};

console.log('📝 Logging to file enabled:', logFilePath);

// 🚨 Inicializar Sentry INMEDIATAMENTE después de las variables de entorno
import { initSentry } from './config/sentry.js';
initSentry();

// ================================================================
// 🔒 DESACTIVACIÓN DE LOGS EN PRODUCCIÓN (SEGURIDAD)
// ================================================================
if (process.env.NODE_ENV === 'production') {
    // Desactivar logs EN PANTALLA pero seguir escribiendo a archivo
    console.log = function (...args) {
        writeToLogFile('LOG', ...args);
    };
    console.debug = function (...args) {
        writeToLogFile('DEBUG', ...args);
    };
    console.info = function (...args) {
        writeToLogFile('INFO', ...args);
    };
    console.table = function () {
        // table no se loguea a archivo
    };
    
    // Mantener console.warn y console.error para monitoreo (ya interceptados arriba)
    
    console.warn('🔒 [PRODUCTION MODE] console.log/debug/info/table desactivados en pantalla (pero logueados a archivo)');
}

import http from 'http';
import app from './app.js';
import { sequelize } from "./database/database.js";

// Socket.IO
import { setupChatSocketIO } from './controllers/chat/socket.controller.js';
import { setupNotificationsSocketIO } from './controllers/notifications/socket.controller.js';
import { initSocketIO, getIO } from './socket.js';



// Cargar todos los modelos antes de sync
import './models/User.js';
import './models/Variedad.js';
import './models/Slider.js';
import './models/Galeria.js';
import './models/Categorie.js';
import './models/Product.js';
import './models/Sale.js';
import './models/Shipment.js';
import './models/SaleDetail.js';
import './models/SaleAddress.js';
import './models/Review.js';
import './models/DiscountCategorie.js';
import './models/DiscountProduct.js';
import './models/Discount.js';
import './models/CuponeCategorie.js';
import './models/CuponeProduct.js';
import './models/Cupone.js';
import './models/Cart.js';
import './models/CartCache.js'; 
import './models/Wishlist.js';
import './models/AddressClient.js';
import './models/AddressGuest.js'; 
import './models/ProductVariants.js';
import './models/File.js';
import './models/Option.js';
import './models/chat/ChatConversation.js';
import './models/chat/ChatMessage.js';
import './models/chat/TenantChatConfig.js'; // 🚀 Multi-Tenant Chat Config
import './models/chat/TenantAgent.js';       // 🚀 Tenant Agents
import './models/ReturnRequest.js';
import './models/Notification.js';
import './models/Module.js';
import './models/Tenant.js';
import './models/TenantNote.js';
import './models/StripeWebhookLog.js';
import './models/MailflowSequence.js';
import './models/MailflowContact.js';
import './models/VideoJob.js';

// 🎯 Preview Mode Services (Auto-register generators)
import './services/mailflowPreview.js';
import modulePreviewService from './services/modulePreviewService.js';

// Asociaciones
import './models/Associations.js';

async function main() {
    try {
        const isDev = process.env.NODE_ENV !== 'production';
        console.warn(`Environment: ${isDev ? 'DEVELOPMENT' : 'PRODUCTION'}`);

        // -------------------------------------------
        // 🔐 SEGURIDAD DB - DEV vs PRODUCTION
        // -------------------------------------------
        if (isDev) {
            console.log("🔧 DEV: autenticando DB (sin alterar tablas automáticamente)");
            
            //await sequelize.sync({ force: true });
            await sequelize.authenticate(); 
            console.log("✅ DEV: DB conectada");
            console.log("💡 Para aplicar cambios en desarrollo, usa migraciones locales con sequelize-cli");
        } else {
            console.warn("🔥 PROD: autenticando la base de datos. NO sync automático");
            await sequelize.authenticate();
            console.warn("✅ PROD: DB conectada. Ejecuta migraciones con 'npx sequelize-cli db:migrate'");
        }

        // -------------------------------------------
        // 🚀 HTTP + SOCKET.IO
        // -------------------------------------------
        const server = http.createServer(app);

        // Iniciar Socket.IO y esperar a que esté listo
        const io = await initSocketIO(server);

        // 🎯 Initialize Preview Mode system
        modulePreviewService.initializeBuiltInPreviews();
        console.log('✅ Module Preview System initialized');
        setupChatSocketIO(io);
        setupNotificationsSocketIO(io);

        // -------------------------------------------
        // 🚀 INICIAR SERVIDOR EXPRESS
        // -------------------------------------------
        const PORT = process.env.PORT || 3500;

        server.listen(PORT, async () => {
            console.warn(`🚀 Server running on port ${PORT}`);
            console.warn("📡 WebSockets ready");

            // Inicializar cron jobs (Sprint 6B - Iteración 4)
            try {
                const { initCronJobs } = await import('./cron/cronJobs.js');
                initCronJobs();
            } catch (error) {
                console.error('❌ Error inicializando cron jobs:', error);
            }

            // Inicializar cron de notificaciones SaaS trial
            try {
                const { startTrialNotificationsCron } = await import('./cron/trial-notifications.cron.js');
                startTrialNotificationsCron();
            } catch (error) {
                console.error('❌ Error inicializando trial notifications cron:', error);
            }

            // Inicializar cron de Video Express polling
            try {
                const { startVideoExpressPolling } = await import('./cron/videoExpressPolling.js');
                startVideoExpressPolling();
            } catch (error) {
                console.error('❌ Error inicializando Video Express polling:', error);
            }
        });

    } catch (error) {
        console.error("❌ Unable to start server:", error);
        process.exit(1);
    }
}

main();
