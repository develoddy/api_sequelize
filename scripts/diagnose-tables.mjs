/**
 * 🔍 Script de diagnóstico para ver nombres reales de tablas y columnas
 * 
 * Uso: NODE_ENV=production node scripts/diagnose-tables.mjs
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
    logging: false
  }
);

async function diagnoseTables() {
  try {
    console.log(`\n🔍 Diagnóstico de Base de Datos (${env})`);
    console.log(`📦 Database: ${process.env.MYSQL_DATABASE}\n`);
    
    // 1. Listar TODAS las tablas
    console.log('📋 TABLAS DISPONIBLES:');
    console.log('─'.repeat(60));
    const [tables] = await sequelize.query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = '${process.env.MYSQL_DATABASE}'
      ORDER BY TABLE_NAME
    `);
    
    tables.forEach(t => console.log(`  • ${t.TABLE_NAME}`));
    console.log('');
    
    // 2. Buscar tablas de productos (con variaciones de nombre)
    console.log('🔎 BÚSQUEDA DE TABLA DE PRODUCTOS:');
    console.log('─'.repeat(60));
    const productTableVariations = ['products', 'Products', 'PRODUCTS', 'product', 'Product'];
    
    for (const tableName of productTableVariations) {
      const [exists] = await sequelize.query(`
        SELECT TABLE_NAME 
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_SCHEMA = '${process.env.MYSQL_DATABASE}' 
          AND TABLE_NAME = '${tableName}'
      `);
      
      if (exists.length > 0) {
        console.log(`  ✅ Encontrada: '${tableName}'`);
        
        // Mostrar columnas de esta tabla
        const [columns] = await sequelize.query(`
          SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
          FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_SCHEMA = '${process.env.MYSQL_DATABASE}' 
            AND TABLE_NAME = '${tableName}'
          ORDER BY ORDINAL_POSITION
        `);
        
        console.log(`\n     Columnas de '${tableName}':`);
        columns.forEach(col => {
          const hasColumn = col.COLUMN_NAME === 'printful_ignored' ? '⭐' : '  ';
          console.log(`     ${hasColumn} ${col.COLUMN_NAME} (${col.DATA_TYPE})`);
        });
        console.log('');
      }
    }
    
    // 3. Buscar tablas de categorías
    console.log('🔎 BÚSQUEDA DE TABLA DE CATEGORÍAS:');
    console.log('─'.repeat(60));
    const categoryTableVariations = ['categories', 'Categories', 'CATEGORIES', 'category', 'Category'];
    
    for (const tableName of categoryTableVariations) {
      const [exists] = await sequelize.query(`
        SELECT TABLE_NAME 
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_SCHEMA = '${process.env.MYSQL_DATABASE}' 
          AND TABLE_NAME = '${tableName}'
      `);
      
      if (exists.length > 0) {
        console.log(`  ✅ Encontrada: '${tableName}'`);
        
        // Mostrar columnas de esta tabla
        const [columns] = await sequelize.query(`
          SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
          FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_SCHEMA = '${process.env.MYSQL_DATABASE}' 
            AND TABLE_NAME = '${tableName}'
          ORDER BY ORDINAL_POSITION
        `);
        
        console.log(`\n     Columnas de '${tableName}':`);
        columns.forEach(col => {
          const hasColumn = col.COLUMN_NAME === 'custom_image' ? '⭐' : '  ';
          console.log(`     ${hasColumn} ${col.COLUMN_NAME} (${col.DATA_TYPE})`);
        });
        console.log('');
      }
    }
    
    // 4. Verificar específicamente las columnas problemáticas
    console.log('🎯 VERIFICACIÓN ESPECÍFICA DE COLUMNAS PROBLEMÁTICAS:');
    console.log('─'.repeat(60));
    
    const [printfulCheck] = await sequelize.query(`
      SELECT TABLE_NAME, COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = '${process.env.MYSQL_DATABASE}' 
        AND COLUMN_NAME = 'printful_ignored'
    `);
    
    if (printfulCheck.length > 0) {
      console.log(`  ✅ 'printful_ignored' existe en tabla: '${printfulCheck[0].TABLE_NAME}'`);
    } else {
      console.log(`  ❌ 'printful_ignored' NO encontrada en ninguna tabla`);
    }
    
    const [customImageCheck] = await sequelize.query(`
      SELECT TABLE_NAME, COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = '${process.env.MYSQL_DATABASE}' 
        AND COLUMN_NAME = 'custom_image'
    `);
    
    if (customImageCheck.length > 0) {
      console.log(`  ✅ 'custom_image' existe en tabla: '${customImageCheck[0].TABLE_NAME}'`);
    } else {
      console.log(`  ❌ 'custom_image' NO encontrada en ninguna tabla`);
    }
    
    console.log('\n✅ Diagnóstico completado\n');
    
  } catch (error) {
    console.error('❌ Error en el diagnóstico:', error.message);
  } finally {
    await sequelize.close();
  }
}

// Ejecutar
diagnoseTables();
