import mysql from 'mysql2/promise';

const conn = await mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '', // Cambia si tienes contraseña
  database: 'ecommercedb'
});

// Verificar columnas de video_jobs
console.log('📋 Columnas de video_jobs:');
const [columns] = await conn.query("SHOW COLUMNS FROM video_jobs");
const columnNames = columns.map(c => c.Field);
console.log(columnNames.join(', '));

// Verificar si is_preview existe
const hasIsPreview = columnNames.includes('is_preview');
console.log(`\n${hasIsPreview ? '✅' : '❌'} is_preview: ${hasIsPreview ? 'EXISTE' : 'NO EXISTE'}`);

// Verificar migraciones aplicadas
const [migrations] = await conn.query("SELECT name FROM SequelizeMeta WHERE name LIKE '%video%' ORDER BY name");
console.log('\n📦 Migraciones de video aplicadas:');
migrations.forEach(m => console.log(`  - ${m.name}`));

// Si is_preview no existe, la migración falló
if (!hasIsPreview) {
  console.log('\n⚠️  La migración 20260209000001-add-preview-fields-to-video-jobs.cjs está registrada pero no se aplicó correctamente');
  console.log('💡 Solución: Eliminar el registro de SequelizeMeta y volver a ejecutarla');
  
  // Eliminar registro
  await conn.query("DELETE FROM SequelizeMeta WHERE name = '20260209000001-add-preview-fields-to-video-jobs.cjs'");
  console.log('✅ Registro eliminado. Ejecuta: npm run db:migrate:dev');
}

await conn.end();
