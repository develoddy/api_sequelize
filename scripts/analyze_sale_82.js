// Verificar datos de la venta #82 (PayPal)
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import { sequelize } from '../src/database/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env.development') });

async function analyzeSale82() {
  try {
    console.log('🔍 Analizando venta #82 (PayPal) para entender inconsistencias...\n');

    // Query detallado para venta #82
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
        sd.createdAt,
        sd.updatedAt,
        p.title as product_title,
        p.price_usd as product_price,
        v.retail_price as variant_price,
        s.total as sale_total,
        s.method_payment
      FROM sale_details sd
      LEFT JOIN products p ON sd.productId = p.id
      LEFT JOIN variedades v ON sd.variedadId = v.id
      LEFT JOIN sales s ON sd.saleId = s.id
      WHERE sd.saleId = 82
      ORDER BY sd.id;
    `);

    console.log('📊 ANÁLISIS DETALLADO DE VENTA #82 (PAYPAL):');
    console.log('=' .repeat(80));
    
    results.forEach((row, index) => {
      console.log(`\n📦 ${row.product_title}`);
      console.log(`   🏷️  Sale Detail ID: ${row.id}`);
      console.log(`   💰 Precio original (variant): ${row.variant_price}€`);
      console.log(`   💰 Precio final (price_unitario): ${row.price_unitario}€`);
      console.log(`   📉 Descuento almacenado: ${row.stored_discount}%`);
      console.log(`   🎟️  Cupón: ${row.code_cupon || 'N/A'}`);
      console.log(`   ⚡ Flash/Campaign: ${row.code_discount || 'N/A'}`);
      console.log(`   💵 Total: ${row.total}€`);
      console.log(`   🕐 Creado: ${row.createdAt}`);
      console.log(`   🕐 Actualizado: ${row.updatedAt}`);
      
      // Calcular lo que debería ser con .95
      const originalPrice = row.variant_price || row.product_price || 0;
      const storedDiscount = row.stored_discount || 0;
      const expectedDiscountAmount = (originalPrice * storedDiscount) / 100;
      const expectedFinalPrice = originalPrice - expectedDiscountAmount;
      const expectedPriceWith95 = Math.floor(expectedFinalPrice) + 0.95;
      
      console.log(`   🧮 Cálculo esperado:`);
      console.log(`      Original: ${originalPrice}€`);
      console.log(`      Descuento ${storedDiscount}%: ${expectedDiscountAmount.toFixed(2)}€`);
      console.log(`      Final esperado: ${expectedFinalPrice.toFixed(2)}€`);
      console.log(`      Con .95 redondeo: ${expectedPriceWith95.toFixed(2)}€`);
      console.log(`      ❌ Actual almacenado: ${row.price_unitario}€`);
      console.log('-'.repeat(50));
    });

    // Mostrar total de la venta
    if (results.length > 0) {
      console.log(`\n💰 TOTAL DE LA VENTA: ${results[0].sale_total}€`);
      console.log(`💳 MÉTODO DE PAGO: ${results[0].method_payment}`);
    }

    console.log('\n✅ Análisis completado');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
}

analyzeSale82();