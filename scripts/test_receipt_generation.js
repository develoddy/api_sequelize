import { sequelize } from '../src/database/database.js';

/**
 * Script para verificar cómo se generarían los recibos
 * con el campo type_campaign
 */

const testReceiptGeneration = async () => {
  try {
    console.log('🔍 Verificando datos de recibos con type_campaign...\n');

    // Consulta SQL directa para obtener detalles de venta del Pedido #96
    const [saleDetails] = await sequelize.query(`
      SELECT 
        sd.id,
        sd.saleId,
        sd.price_unitario,
        sd.cantidad,
        sd.total,
        sd.type_campaign,
        sd.type_discount,
        sd.discount,
        sd.code_cupon,
        sd.code_discount,
        p.title as product_title
      FROM sale_details sd
      LEFT JOIN products p ON sd.productId = p.id
      WHERE sd.saleId = 96
      ORDER BY sd.id
    `);

    if (!saleDetails || saleDetails.length === 0) {
      console.log('⚠️  No se encontraron detalles para Pedido #96');
      process.exit(0);
    }

    console.log(`✅ Detalles encontrados para Pedido #96\n`);
    console.log('📦 DETALLES DE VENTA:\n');

    saleDetails.forEach((d, index) => {
      
      console.log(`\n${index + 1}. ${d.product_title || 'Producto sin nombre'}`);
      console.log('   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`   📌 SaleDetail ID: ${d.id}`);
      console.log(`   💰 Precio unitario guardado: €${d.price_unitario}`);
      console.log(`   🔢 Cantidad: ${d.cantidad}`);
      console.log(`   💵 Total: €${d.total}`);
      console.log(`   \n   🏷️  CAMPOS DE DESCUENTO:`);
      console.log(`   ├─ type_campaign: ${d.type_campaign || 'NULL'}`);
      console.log(`   ├─ type_discount: ${d.type_discount}`);
      console.log(`   ├─ discount: ${d.discount}%`);
      console.log(`   ├─ code_cupon: ${d.code_cupon || 'NULL'}`);
      console.log(`   └─ code_discount: ${d.code_discount || 'NULL'}`);
      
      // Detectar tipo usando type_campaign (como lo hace el backend)
      let discountType = 'Sin descuento';
      if (d.type_campaign === 3 || d.code_cupon) {
        discountType = `Cupón ${d.code_cupon || ''}`;
      } else if (d.type_campaign === 2) {
        discountType = 'Flash Sale';
      } else if (d.type_campaign === 1) {
        discountType = 'Campaign Discount';
      } else if (d.code_discount || d.discount) {
        // Fallback para registros antiguos
        if (d.code_discount) {
          discountType = 'Flash Sale (fallback)';
        } else if (d.discount) {
          discountType = 'Campaign Discount (fallback)';
        }
      }
      
      console.log(`   \n   🎯 TIPO DETECTADO EN PDF: "${discountType}"`);
      
      // Verificar consistencia
      if (d.type_campaign === 2 && discountType === 'Flash Sale') {
        console.log(`   ✅ CORRECTO: type_campaign=2 coincide con Flash Sale`);
      } else if (d.type_campaign === 1 && discountType === 'Campaign Discount') {
        console.log(`   ✅ CORRECTO: type_campaign=1 coincide con Campaign Discount`);
      } else if (d.type_campaign === 3 && d.code_cupon) {
        console.log(`   ✅ CORRECTO: type_campaign=3 coincide con Cupón`);
      } else if (!d.type_campaign && (d.code_discount || d.discount)) {
        console.log(`   ⚠️  REGISTRO ANTIGUO: Usando fallback logic`);
      } else if (!d.type_campaign && !d.code_discount && !d.discount) {
        console.log(`   ✅ CORRECTO: Sin descuento aplicado`);
      }
    });

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Verificación completada');
    console.log('\n💡 CONCLUSIÓN:');
    console.log('   - Los recibos PDF ahora usarán type_campaign para detectar el tipo');
    console.log('   - Frontend y backend mostrarán labels consistentes');
    console.log('   - Los registros antiguos sin type_campaign usarán fallback logic\n');

    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

testReceiptGeneration();
