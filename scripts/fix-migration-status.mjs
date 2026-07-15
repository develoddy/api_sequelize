/**
 * 🔧 Script para marcar migraciones como ejecutadas sin ejecutarlas
 * 
 * Uso: NODE_ENV=production node scripts/fix-migration-status.mjs
 * 
 * ⚠️ Solo usar cuando las columnas ya existen en la BD
 */

import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar variables de entorno según NODE_ENV
const env = process.env.NODE_ENV || 'development';
const envFile = env === 'production' ? '.env.production' : '.env.development';
dotenv.config({ path: path.resolve(__dirname, '..', envFile) });

// Configuración de la base de datos
const sequelize = new Sequelize(
  process.env.MYSQL_DATABASE,
  process.env.MYSQL_USER,
  process.env.MYSQL_PASSWORD,
  {
    host: process.env.MYSQL_HOST,
    port: process.env.MYSQL_PORT || 3306,
    dialect: 'mysql',
    logging: console.log
  }
);

async function checkColumnExists(tableName, columnName) {
  try {
    const [results] = await sequelize.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = '${process.env.MYSQL_DATABASE}' 
        AND TABLE_NAME = '${tableName}' 
        AND COLUMN_NAME = '${columnName}'
    `);
    return results.length > 0;
  } catch (error) {
    console.error(`Error checking column ${columnName}:`, error.message);
    return false;
  }
}

async function markMigrationAsExecuted(migrationName) {
  try {
    await sequelize.query(`
      INSERT INTO SequelizeMeta (name) 
      VALUES ('${migrationName}')
    `);
    console.log(`✅ Migración '${migrationName}' marcada como ejecutada`);
  } catch (error) {
    console.error(`❌ Error al marcar migración '${migrationName}':`, error.message);
  }
}

async function fixMigrationStatus() {
  try {
    console.log(`\n🔍 Verificando estado de la base de datos (${env})...\n`);
    
    // Verificar columna printful_ignored en products
    const printfulIgnoredExists = await checkColumnExists('products', 'printful_ignored');
    console.log(`📋 Columna 'printful_ignored' en 'products': ${printfulIgnoredExists ? '✅ EXISTE' : '❌ NO EXISTE'}`);
    
    // Verificar columna custom_image en categories
    const customImageExists = await checkColumnExists('categories', 'custom_image');
    console.log(`📋 Columna 'custom_image' en 'categories': ${customImageExists ? '✅ EXISTE' : '❌ NO EXISTE'}`);
    
    console.log('\n');
    
    // Si las columnas existen, marcar migraciones como ejecutadas
    if (printfulIgnoredExists) {
      await markMigrationAsExecuted('20260715000000-add-printful-ignored-to-products.cjs');
    } else {
      console.log('⚠️  La columna printful_ignored NO existe. Debes ejecutar la migración normalmente.');
    }
    
    if (customImageExists) {
      await markMigrationAsExecuted('20260715000001-add-custom-image-to-categories.cjs');
    } else {
      console.log('⚠️  La columna custom_image NO existe. Debes ejecutar la migración normalmente.');
    }
    
    console.log('\n✅ Proceso completado. Verifica con: NODE_ENV=production npx sequelize-cli db:migrate:status\n');
    
  } catch (error) {
    console.error('❌ Error en el proceso:', error);
  } finally {
    await sequelize.close();
  }
}

// Ejecutar
fixMigrationStatus();
