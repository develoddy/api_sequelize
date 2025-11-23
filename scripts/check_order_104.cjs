const { Sequelize } = require('sequelize');
const config = require('../config/config.cjs');

const sequelize = new Sequelize(
  config.development.database,
  config.development.username,
  config.development.password,
  {
    host: config.development.host,
    dialect: config.development.dialect,
    logging: (sql) => console.log('Executing (default):', sql)
  }
);

async function checkOrder104() {
  try {
    console.log('🔍 Verificando Pedido #104...\n');

    // Obtener detalles del pedido
    const [saleDetails] = await sequelize.query(`
      SELECT 
        sd.id,
        sd.saleId,
        sd.productId,
        sd.variedadId,
        sd.price_unitario,
        sd.cantidad,
        sd.subtotal,
        sd.total,
        sd.type_campaign,
        sd.type_discount,
        sd.discount,
        sd.code_cupon,
        sd.code_discount,
        p.title as product_title,
        v.retail_price as variedad_retail_price
      FROM sale_details sd
      LEFT JOIN products p ON sd.productId = p.id
      LEFT JOIN variedades v ON sd.variedadId = v.id
      WHERE sd.saleId = 104
      ORDER BY sd.id
    `);

    console.log('📦 DETALLES DEL PEDIDO #104:\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    saleDetails.forEach((detail, index) => {
      console.log(`${index + 1}. ${detail.product_title}`);
      console.log(`   SaleDetail ID: ${detail.id}`);
      console.log(`   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`   💰 PRECIOS:`);
      console.log(`   ├─ Precio original (variedad): €${detail.variedad_retail_price}`);
      console.log(`   ├─ Precio unitario guardado: €${detail.price_unitario}`);
      console.log(`   ├─ Cantidad: ${detail.cantidad}`);
      console.log(`   ├─ Subtotal: €${detail.subtotal}`);
      console.log(`   └─ Total: €${detail.total}\n`);

      console.log(`   🏷️  CAMPOS DE DESCUENTO:`);
      console.log(`   ├─ type_campaign: ${detail.type_campaign === null ? 'NULL ❌' : detail.type_campaign + ' ✅'}`);
      console.log(`   ├─ type_discount: ${detail.type_discount}`);
      console.log(`   ├─ discount: ${detail.discount}%`);
      console.log(`   ├─ code_cupon: ${detail.code_cupon || 'NULL'}`);
      console.log(`   └─ code_discount: ${detail.code_discount || 'NULL'}\n`);

      // Análisis
      const originalPrice = parseFloat(detail.variedad_retail_price);
      const finalPrice = parseFloat(detail.price_unitario);
      const realDiscount = originalPrice - finalPrice;
      const realPercentage = ((realDiscount / originalPrice) * 100).toFixed(2);

      console.log(`   🧮 ANÁLISIS:`);
      console.log(`   ├─ Descuento real aplicado: €${realDiscount.toFixed(2)}`);
      console.log(`   └─ Porcentaje real: ${realPercentage}%\n`);

      if (detail.type_campaign === null) {
        console.log(`   ⚠️  PROBLEMA: type_campaign es NULL`);
        console.log(`   ⚠️  Debería ser: 2 (Flash Sale) porque code_discount = "${detail.code_discount}"\n`);
      } else if (detail.type_campaign === 2) {
        console.log(`   ✅ CORRECTO: type_campaign = 2 (Flash Sale)\n`);
      }

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await sequelize.close();
  }
}

checkOrder104();
