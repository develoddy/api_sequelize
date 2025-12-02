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
// 🔒 DESACTIVACIÓN DE LOGS EN PRODUCCIÓN (SEGURIDAD)
// ================================================================
if (process.env.NODE_ENV === 'production') {
    // Desactivar logs que podrían exponer información sensible
    console.log = function () {};
    console.debug = function () {};
    console.info = function () {};
    console.table = function () {};
    
    // Mantener console.warn y console.error para monitoreo
    // console.warn y console.error NO se desactivan
    
    console.warn('🔒 [PRODUCTION MODE] console.log/debug/info/table desactivados por seguridad');
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
import './models/ReturnRequest.js';
import './models/Notification.js';

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
        });

    } catch (error) {
        console.error("❌ Unable to start server:", error);
        process.exit(1);
    }
}

main();
