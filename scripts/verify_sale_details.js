// Script para acceder directamente a la tabla sale_details
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import { sequelize } from '../src/database/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env.development') });

async function verifySaleDetails() {
  try {
    console.log('🔍 Accediendo directamente a la tabla sale_details...\n');

    // Query directo a la tabla sale_details para venta #79
    const [results] = await sequelize.query(`
      SELECT 
        sd.id,
        sd.saleId,
        sd.productId,
        sd.variedadId,
        sd.price_unitario,
        sd.subtotal,
        sd.total,
        sd.discount,
        sd.type_discount,
        sd.code_cupon,
        sd.code_discount,
        sd.createdAt,
        sd.updatedAt,
        p.title as product_title
      FROM sale_details sd
      LEFT JOIN products p ON sd.productId = p.id
      WHERE sd.saleId = 79
      ORDER BY sd.id;
    `);

    console.log('📦 DATOS REALES EN LA BASE DE DATOS (sale_details):');
    console.log('=' .repeat(80));
    
    results.forEach((row, index) => {
      console.log(`\n🏷️  Sale Detail ID: ${row.id}`);
      console.log(`📝 Producto: ${row.product_title}`);
      console.log(`💰 price_unitario: ${row.price_unitario}€`);
      console.log(`📊 subtotal: ${row.subtotal}€`);
      console.log(`💵 total: ${row.total}€`);
      console.log(`📉 discount: ${row.discount}% (${row.code_cupon || row.code_discount || 'N/A'})`);
      console.log(`🕐 createdAt: ${row.createdAt}`);
      console.log(`🕐 updatedAt: ${row.updatedAt}`);
      console.log('-'.repeat(50));
    });

    // También verificar la venta #78 para comparar
    console.log('\n\n🔍 Comparando con venta #78 (antes del fix)...\n');
    
    const [results78] = await sequelize.query(`
      SELECT 
        sd.id,
        sd.price_unitario,
        sd.discount,
        sd.code_cupon,
        sd.code_discount,
        p.title as product_title
      FROM sale_details sd
      LEFT JOIN products p ON sd.productId = p.id
      WHERE sd.saleId = 78
      ORDER BY sd.id;
    `);

    console.log('📦 VENTA #78 (SIN FIX):');
    results78.forEach(row => {
      console.log(`   ${row.product_title}: ${row.price_unitario}€ (desc: ${row.discount}%)`);
    });

    console.log('\n📦 VENTA #79 (CON FIX):');
    results.forEach(row => {
      console.log(`   ${row.product_title}: ${row.price_unitario}€ (desc: ${row.discount}%)`);
    });

    console.log('\n' + '='.repeat(80));
    console.log('✅ Verificación completada - Datos extraídos directamente de MySQL');
    
  } catch (error) {
    console.error('❌ Error accediendo a la base de datos:', error.message);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
}

verifySaleDetails();