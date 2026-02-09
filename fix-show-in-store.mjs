/**
 * Script de emergencia: Actualizar show_in_store
 * Ejecutar con: node fix-show-in-store.mjs
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function fixShowInStore() {
  let connection;
  
  try {
    // Conectar a la BD
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'ecommercedb'
    });

    console.log('✅ Conectado a la base de datos');

    // Verificar que la columna existe
    const [columns] = await connection.query(`
      SHOW COLUMNS FROM modules LIKE 'show_in_store'
    `);

    if (columns.length === 0) {
      console.log('❌ La columna show_in_store no existe. Ejecuta primero: npm run db:migrate:dev');
      return;
    }

    console.log('✅ Columna show_in_store existe');

    // Ejecutar UPDATE
    const [result] = await connection.query(`
      UPDATE modules 
      SET show_in_store = TRUE 
      WHERE is_active = TRUE 
        AND status IN ('live', 'testing')
        AND \`key\` IN ('video-express', 'mailflow', 'key-module')
    `);

    console.log(`✅ Se actualizaron ${result.affectedRows} módulos con show_in_store = TRUE`);

    // Verificar resultado
    const [modules] = await connection.query(`
      SELECT \`key\`, name, status, is_active, show_in_store 
      FROM modules 
      WHERE show_in_store = TRUE
    `);

    console.log('\n📦 Módulos visibles en MVP Hub:');
    modules.forEach(m => {
      console.log(`  - ${m.key}: ${m.name} (${m.status})`);
    });

    // Marcar migración como completada (si no lo está)
    const [meta] = await connection.query(`
      SELECT name FROM SequelizeMeta 
      WHERE name = '20250209000000-add-show-in-store-to-modules.cjs'
    `);

    if (meta.length === 0) {
      await connection.query(`
        INSERT INTO SequelizeMeta (name) 
        VALUES ('20250209000000-add-show-in-store-to-modules.cjs')
      `);
      console.log('\n✅ Migración marcada como completada');
    } else {
      console.log('\n✅ Migración ya estaba registrada');
    }

    console.log('\n🎉 Todo listo! Reinicia el backend.');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

fixShowInStore();
