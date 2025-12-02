// ================================================================
// 🔧 CONFIGURACIÓN DE VARIABLES DE ENTORNO
// ================================================================
// Este archivo DEBE ser importado PRIMERO en index.js
// para asegurar que las variables estén disponibles antes de
// importar cualquier otro módulo (database.js, stripe.js, etc.)
// ================================================================

import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Obtener __dirname en ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Selecciona explícitamente el archivo según NODE_ENV
const envFile = process.env.NODE_ENV === 'production' 
    ? '.env.production' 
    : '.env.development';

// Ruta absoluta: src/config/ -> sube a src/ -> sube a api/ -> .env.production
const envPath = path.resolve(__dirname, '../../', envFile);
dotenv.config({ path: envPath });

// Debug temporal para producción
console.error(`🔧 [env.js] Loading from: ${envPath}`);
console.error(`🔧 [env.js] File exists: ${fs.existsSync(envPath)}`);
console.error(`🔧 [env.js] DB_HOST: ${process.env.DB_HOST || 'NOT LOADED'}`);

// Log solo en desarrollo
if (process.env.NODE_ENV !== 'production') {
    console.log(`🌐 Variables de entorno cargadas desde: ${envFile}`);
    console.log(`📂 Ruta: ${envPath}`);
}
