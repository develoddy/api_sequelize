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

// Obtener __dirname en ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Selecciona explícitamente el archivo según NODE_ENV
const envFile = process.env.NODE_ENV === 'production' 
    ? '.env.production' 
    : '.env.development';

// Ruta absoluta para asegurar que PM2 encuentre el archivo
const envPath = path.resolve(__dirname, '../..', envFile);
dotenv.config({ path: envPath });

// Log solo en desarrollo
if (process.env.NODE_ENV !== 'production') {
    console.log(`🌐 Variables de entorno cargadas desde: ${envFile}`);
    console.log(`📂 Ruta: ${envPath}`);
}
