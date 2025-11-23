import { sequelize } from '../src/database/database.js';

/**
 * Script para verificar el último pedido y sus detalles
 */

const checkLatestPurchase = async () => {
  try {
    console.log('🔍 Buscando el último pedido...\n');

    // Obtener el último pedido
    const [sales] = await sequelize.query(`
      SELECT 
        s.id,
        s.userId,
        s.guestId,
        s.method_payment,
        s.total,
        s.createdAt
      FROM sales s
      ORDER BY s.id DESC
      LIMIT 1
    `);

    if (!sales || sales.length === 0) {
      console.log('⚠️  No se encontraron ventas');
      process.exit(0);
    }

    const sale = sales[0];
    console.log(`✅ ÚLTIMO PEDIDO: #${sale.id}`);
    console.log(`📅 Fecha: ${sale.createdAt}`);
    console.log(`💳 Método: ${sale.method_payment}`);
    console.log(`💰 Total: €${sale.total}\n`);

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
      WHERE sd.saleId = ?
      ORDER BY sd.id
    `, {
      replacements: [sale.id]
    });

    console.log('📦 DETALLES DEL PEDIDO:\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    saleDetails.forEach((detail, index) => {
      console.log(`${index + 1}. ${detail.product_title || 'Producto sin nombre'}`);
      console.log(`   SaleDetail ID: ${detail.id}`);
      console.log(`   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`   💰 PRECIOS:`);
      console.log(`   ├─ Precio original (variedad): €${detail.variedad_retail_price}`);
      console.log(`   ├─ Precio unitario guardado: €${detail.price_unitario}`);
      console.log(`   ├─ Cantidad: ${detail.cantidad}`);
      console.log(`   ├─ Subtotal: €${detail.subtotal}`);
      console.log(`   └─ Total: €${detail.total}`);
      
      console.log(`\n   🏷️  CAMPOS DE DESCUENTO:`);
      console.log(`   ├─ type_campaign: ${detail.type_campaign || 'NULL'} ${detail.type_campaign ? `(${detail.type_campaign === 1 ? 'Campaign' : detail.type_campaign === 2 ? 'Flash Sale' : detail.type_campaign === 3 ? 'Cupón' : 'Unknown'})` : ''}`);
      console.log(`   ├─ type_discount: ${detail.type_discount}`);
      console.log(`   ├─ discount: ${detail.discount}${detail.type_discount === 1 ? '%' : '€'}`);
      console.log(`   ├─ code_cupon: ${detail.code_cupon || 'NULL'}`);
      console.log(`   └─ code_discount: ${detail.code_discount || 'NULL'}`);

      // Calcular qué descuento se aplicó realmente
      const originalPrice = parseFloat(detail.variedad_retail_price || 0);
      const finalPrice = parseFloat(detail.price_unitario || 0);
      const realDiscount = originalPrice - finalPrice;
      const realPercentage = originalPrice > 0 ? ((realDiscount / originalPrice) * 100).toFixed(2) : 0;

      console.log(`\n   🧮 CÁLCULO REAL:`);
      console.log(`   ├─ Descuento aplicado: €${realDiscount.toFixed(2)}`);
      console.log(`   └─ Porcentaje real: ${realPercentage}%`);

      // Detectar tipo usando type_campaign (como lo hace el frontend)
      let detectedType = 'Sin descuento';
      if (detail.type_campaign === 3 || detail.code_cupon) {
        detectedType = `Cupón ${detail.code_cupon || ''}`;
      } else if (detail.type_campaign === 2) {
        detectedType = 'Flash Sale';
      } else if (detail.type_campaign === 1) {
        detectedType = 'Campaign Discount';
      } else if (!detail.type_campaign && (detail.code_discount || detail.discount)) {
        // Fallback para registros sin type_campaign
        if (detail.code_discount) {
          detectedType = 'Flash Sale (fallback - NO type_campaign)';
        } else if (detail.discount) {
          detectedType = 'Campaign Discount (fallback - NO type_campaign)';
        }
      }

      console.log(`\n   🎯 TIPO DETECTADO EN UI: "${detectedType}"`);

      // Validar consistencia
      if (!detail.type_campaign && detail.code_discount) {
        console.log(`   ⚠️  PROBLEMA: code_discount existe pero type_campaign es NULL`);
        console.log(`   ⚠️  Frontend mostrará "Campaign Discount" por el fallback`);
      } else if (detail.type_campaign === 2 && detectedType === 'Flash Sale') {
        console.log(`   ✅ CORRECTO: type_campaign=2 coincide con Flash Sale`);
      } else if (detail.type_campaign === 1) {
        console.log(`   ✅ CORRECTO: type_campaign=1 = Campaign Discount`);
      }

      console.log('\n');
    });

    // Verificar si hay un carrito asociado para ver qué se guardó ahí
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🛒 VERIFICANDO CARRITOS RECIENTES DEL USUARIO...\n');

    const userId = sale.userId || sale.guestId;
    if (userId) {
      const [carts] = await sequelize.query(`
        SELECT 
          c.id,
          c.productId,
          c.variedadId,
          c.type_campaign,
          c.type_discount,
          c.discount,
          c.code_cupon,
          c.code_discount,
          c.price_unitario,
          c.createdAt,
          p.title as product_title
        FROM carts c
        LEFT JOIN products p ON c.productId = p.id
        WHERE c.userId = ? OR c.guestId = ?
        ORDER BY c.id DESC
        LIMIT 5
      `, {
        replacements: [userId, userId]
      });

      if (carts.length > 0) {
        console.log('📋 Últimos carritos (deberían estar vacíos si se completó la compra):\n');
        carts.forEach((cart, idx) => {
          console.log(`${idx + 1}. ${cart.product_title}`);
          console.log(`   ├─ Cart ID: ${cart.id}`);
          console.log(`   ├─ type_campaign: ${cart.type_campaign || 'NULL'}`);
          console.log(`   ├─ discount: ${cart.discount}%`);
          console.log(`   ├─ code_discount: ${cart.code_discount || 'NULL'}`);
          console.log(`   └─ Creado: ${cart.createdAt}\n`);
        });
      } else {
        console.log('✅ No hay carritos pendientes (correcto después de compra)\n');
      }
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n💡 ANÁLISIS:');
    
    const hasTypeCampaignNull = saleDetails.some(d => d.type_campaign === null && (d.code_discount || d.discount));
    if (hasTypeCampaignNull) {
      console.log('   ❌ PROBLEMA ENCONTRADO:');
      console.log('   - type_campaign es NULL pero hay descuento');
      console.log('   - Backend NO guardó el type_campaign correctamente');
      console.log('   - Necesitamos verificar por qué carts.controller.js no está funcionando\n');
    } else {
      console.log('   ✅ type_campaign está guardado correctamente\n');
    }

    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

checkLatestPurchase();
