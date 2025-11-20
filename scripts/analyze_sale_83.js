// Verificar datos de la venta #83
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import { sequelize } from '../src/database/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env.development') });

async function analyzeSale83() {
  try {
    console.log('🔍 Analizando venta #83 (escenario complejo)...\n');

    // Query detallado para venta #83
    const [results] = await sequelize.query(`
      SELECT 
        sd.id,
        sd.discount as stored_discount,
        sd.price_unitario,
        sd.subtotal,
        sd.total,
        sd.code_cupon,
        sd.code_discount,
        sd.type_discount,
        p.title as product_title,
        s.total as sale_total,
        s.method_payment
      FROM sale_details sd
      LEFT JOIN products p ON sd.productId = p.id
      LEFT JOIN sales s ON sd.saleId = s.id
      WHERE sd.saleId = 83
      ORDER BY sd.id;
    `);

    console.log('📊 ANÁLISIS DETALLADO DE VENTA #83:');
    console.log('=' .repeat(80));
    
    let calculatedTotal = 0;
    
    results.forEach((row, index) => {
      console.log(`\n📦 ${row.product_title}`);
      console.log(`   💰 Precio unitario: ${row.price_unitario}€`);
      console.log(`   💵 Total: ${row.total}€`);
      console.log(`   📉 Descuento: ${row.stored_discount}%`);
      console.log(`   🎟️  Cupón: ${row.code_cupon || 'N/A'}`);
      console.log(`   ⚡ Flash/Campaign: ${row.code_discount || 'N/A'}`);
      
      calculatedTotal += parseFloat(row.total);
    });

    console.log('\n' + '='.repeat(80));
    console.log(`📊 RESUMEN:`);
    console.log(`   ➕ Suma de productos: ${calculatedTotal.toFixed(2)}€`);
    console.log(`   💰 Total almacenado en venta: ${results[0]?.sale_total}€`);
    console.log(`   💳 Método de pago: ${results[0]?.method_payment}`);
    
    if (Math.abs(calculatedTotal - parseFloat(results[0]?.sale_total || 0)) > 0.01) {
      console.log(`   ❌ INCONSISTENCIA: ${calculatedTotal.toFixed(2)} ≠ ${results[0]?.sale_total}`);
    } else {
      console.log(`   ✅ CONSISTENTE`);
    }

    console.log('\n✅ Análisis completado');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
}

analyzeSale83();