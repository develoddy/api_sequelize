import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const conn = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'ecommercedb'
});

try {
  await conn.query(`
    INSERT IGNORE INTO SequelizeMeta (name) 
    VALUES ('20250209000000-add-show-in-store-to-modules.cjs')
  `);
  
  const [rows] = await conn.query(`SELECT name FROM SequelizeMeta ORDER BY name`);
  console.log(`✅ Migración registrada. Total: ${rows.length} migraciones`);
} catch (err) {
  console.error('❌ Error:', err.message);
} finally {
  await conn.end();
}
