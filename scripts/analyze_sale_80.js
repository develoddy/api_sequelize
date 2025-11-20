// Verificar datos específicos de la venta #80
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import { sequelize } from '../src/database/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env.development') });

async function analyzeSale80() {
  try {
    console.log('🔍 Analizando venta #80 para entender los cálculos de descuento...\n');

    // Query detallado para venta #80
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
        p.price_usd as product_price,
        v.retail_price as variant_price
      FROM sale_details sd
      LEFT JOIN products p ON sd.productId = p.id
      LEFT JOIN variedades v ON sd.variedadId = v.id
      WHERE sd.saleId = 80
      ORDER BY sd.id;
    `);

    console.log('📊 ANÁLISIS DETALLADO DE VENTA #80:');
    console.log('=' .repeat(80));
    
    results.forEach((row, index) => {
      console.log(`\n📦 ${row.product_title}`);
      console.log(`   🏷️  Sale Detail ID: ${row.id}`);
      console.log(`   💰 Precio original (variant): ${row.variant_price}€`);
      console.log(`   💰 Precio original (product): ${row.product_price}€`);
      console.log(`   💰 Precio final (price_unitario): ${row.price_unitario}€`);
      console.log(`   📉 Descuento almacenado: ${row.stored_discount}%`);
      console.log(`   🎟️  Cupón: ${row.code_cupon || 'N/A'}`);
      console.log(`   ⚡ Flash/Campaign: ${row.code_discount || 'N/A'}`);
      console.log(`   📊 Type discount: ${row.type_discount}`);
      
      // Calcular porcentaje real
      const originalPrice = row.variant_price || row.product_price || 0;
      const finalPrice = parseFloat(row.price_unitario);
      const realDiscountAmount = originalPrice - finalPrice;
      const realDiscountPercentage = originalPrice > 0 ? 
        Math.round((realDiscountAmount / originalPrice) * 100) : 0;
      
      console.log(`   🧮 Cálculo real:`);
      console.log(`      Original: ${originalPrice}€`);
      console.log(`      Final: ${finalPrice}€`);
      console.log(`      Ahorro: ${realDiscountAmount.toFixed(2)}€`);
      console.log(`      Porcentaje real: ${realDiscountPercentage}%`);
      console.log(`      ❌ Diferencia: ${row.stored_discount}% (almacenado) vs ${realDiscountPercentage}% (real)`);
      console.log('-'.repeat(50));
    });

    console.log('\n✅ Análisis completado');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
}

analyzeSale80();