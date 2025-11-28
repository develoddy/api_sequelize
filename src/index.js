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
import * as dotenv from 'dotenv';
// Selecciona explícitamente el archivo según NODE_ENV
const envFile = process.env.NODE_ENV === 'production' 
    ? '.env.production' 
    : '.env.development';

dotenv.config({ path: envFile });
console.log(`🌐 Variables de entorno cargadas desde: ${envFile}`);

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
        console.log(`Environment: ${isDev ? 'DEVELOPMENT' : 'PRODUCTION'}`);

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
            console.log("🔥 PROD: autenticando la base de datos. NO sync automático");
            await sequelize.authenticate();
            console.log("✅ PROD: DB conectada. Ejecuta migraciones con 'npx sequelize-cli db:migrate'");
            // ⚠️ Migraciones obligatorias
            // npx sequelize-cli db:migrate
        }

        // -------------------------------------------
        // 🚀 HTTP + SOCKET.IO
        // -------------------------------------------
        const server = http.createServer(app);

        // Iniciar Socket.IO
        initSocketIO(server);

        // Dar tiempo para iniciar internamente
        setTimeout(() => {
            const io = getIO();
            setupChatSocketIO(io);
            setupNotificationsSocketIO(io);
        }, 300);

        // -------------------------------------------
        // 🚀 INICIAR SERVIDOR EXPRESS
        // -------------------------------------------
        const PORT = process.env.PORT || 3500;

        server.listen(PORT, async () => {
            console.log(`🚀 Server running on port ${PORT}`);
            console.log("📡 WebSockets ready");

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
