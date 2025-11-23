/**
 * Script para verificar la estructura y datos de los pedidos #92 y #94
 * Propósito: Entender qué campos identifican Campaign Discount vs Flash Sale
 */

import { sequelize } from '../src/database/database.js';

async function checkOrders() {
  try {
    console.log('\n🔍 ========== VERIFICANDO PEDIDOS #92 Y #94 ==========\n');

    // Query directo a la base de datos
    const [results] = await sequelize.query(`
      SELECT 
        s.id as sale_id,
        s.total as sale_total,
        s.createdAt as sale_date,
        sd.id as detail_id,
        sd.type_discount,
        sd.discount,
        sd.code_cupon,
        sd.code_discount,
        sd.price_unitario,
        sd.subtotal,
        sd.total as detail_total,
        sd.cantidad,
        p.title as product_title,
        p.sku as product_sku,
        p.price_usd as product_price,
        v.retail_price as variedad_price
      FROM sales s
      LEFT JOIN sale_details sd ON s.id = sd.saleId
      LEFT JOIN products p ON sd.productId = p.id
      LEFT JOIN variedades v ON sd.variedadId = v.id
      WHERE s.id IN (92, 94)
      ORDER BY s.id ASC, sd.id ASC
    `);

    if (!results || results.length === 0) {
      console.log('❌ No se encontraron los pedidos #92 y #94');
      return;
    }

    let currentSaleId = null;
    
    results.forEach((row, index) => {
      if (row.sale_id !== currentSaleId) {
        currentSaleId = row.sale_id;
        console.log(`\n📦 ========== PEDIDO #${row.sale_id} ==========`);
        console.log(`Total pedido: €${row.sale_total}`);
        console.log(`Fecha: ${row.sale_date}`);
        console.log(`\n📋 Detalles:\n`);
      }
      
      console.log(`   Producto:`);
      console.log(`   - ID detail: ${row.detail_id}`);
      console.log(`   - Título: ${row.product_title || 'N/A'}`);
      console.log(`   - SKU: ${row.product_sku || 'N/A'}`);
      console.log(`   - Cantidad: ${row.cantidad}`);
      
      console.log(`\n   💰 PRECIOS:`);
      console.log(`   - Product price_usd: €${row.product_price || 0}`);
      console.log(`   - Variedad retail_price: €${row.variedad_price || 0}`);
      console.log(`   - price_unitario: €${row.price_unitario}`);
      console.log(`   - subtotal: €${row.subtotal}`);
      console.log(`   - total: €${row.detail_total}`);
      
      console.log(`\n   🏷️ DESCUENTOS:`);
      console.log(`   - type_discount: ${row.type_discount}`);
      console.log(`   - discount: ${row.discount}`);
      console.log(`   - code_cupon: ${row.code_cupon || 'NULL'}`);
      console.log(`   - code_discount: ${row.code_discount || 'NULL'}`);
      
      // Análisis del tipo de descuento
      console.log(`\n   🔍 ANÁLISIS:`);
      
      const originalPrice = row.variedad_price || row.product_price || 0;
      const finalPrice = row.price_unitario;
      const hasRealDiscount = originalPrice > finalPrice;
      
      console.log(`   - Precio original: €${originalPrice}`);
      console.log(`   - Precio final: €${finalPrice}`);
      console.log(`   - ¿Tiene descuento real?: ${hasRealDiscount ? '✅ SÍ' : '❌ NO'}`);
      
      if (hasRealDiscount) {
        const discountAmount = originalPrice - finalPrice;
        const discountPercentage = ((discountAmount / originalPrice) * 100).toFixed(2);
        console.log(`   - Ahorro: €${discountAmount.toFixed(2)} (${discountPercentage}%)`);
        
        // Determinar tipo de descuento según la lógica
        let discountType = 'DESCONOCIDO';
        if (row.code_cupon) {
          discountType = `🎟️ CUPÓN (${row.code_cupon})`;
        } else if (row.code_discount && row.code_discount.toString().trim() !== '' && row.code_discount !== '0') {
          discountType = '⚡ FLASH SALE';
        } else if (row.discount && parseFloat(row.discount) > 0) {
          discountType = '📢 CAMPAIGN DISCOUNT';
        }
        
        console.log(`   - 🏷️ TIPO: ${discountType}`);
      } else {
        console.log(`   - Sin descuento aplicado`);
      }
      
      console.log('\n   ' + '='.repeat(60));
    });

    console.log('\n\n✅ Verificación completada\n');

  } catch (error) {
    console.error('❌ Error verificando pedidos:', error);
  } finally {
    await sequelize.close();
  }
}

checkOrders();
