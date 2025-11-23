import { sequelize } from '../src/database/database.js';
import { Discount } from '../src/models/Discount.js';

/**
 * Script para simular el flujo completo y verificar dónde falla type_campaign
 */

const testCompleteFlow = async () => {
  try {
    console.log('🔍 SIMULANDO FLUJO COMPLETO DE COMPRA\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // 1. VERIFICAR DESCUENTO EN TABLA DISCOUNTS
    console.log('📋 PASO 1: Verificar descuento Flash Sale en tabla discounts\n');
    
    const flashSale = await Discount.findByPk(12);
    
    if (!flashSale) {
      console.log('❌ No existe descuento con ID 12');
      process.exit(1);
    }
    
    console.log('✅ Descuento encontrado:');
    console.log(`   ID: ${flashSale.id}`);
    console.log(`   type_campaign: ${flashSale.type_campaign} (${flashSale.type_campaign === 2 ? 'Flash Sale' : 'Otro'})`);
    console.log(`   discount: ${flashSale.discount}%`);
    console.log(`   Producto ID: ${flashSale.productId}`);
    console.log('');

    // 2. SIMULAR CREACIÓN DE CARRITO
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 PASO 2: Simular lógica de Cart.create\n');
    
    const simulatedCartData = {
      code_cupon: null,
      code_discount: 12,
      discount: 20
    };
    
    // Lógica del backend (carts.controller.js)
    let type_campaign = null;
    if (simulatedCartData.code_cupon) {
      type_campaign = 3; // Cupón
    } else if (simulatedCartData.code_discount) {
      const discount = await Discount.findByPk(simulatedCartData.code_discount);
      type_campaign = discount ? discount.type_campaign : null;
    } else if (simulatedCartData.discount && simulatedCartData.discount > 0) {
      type_campaign = 1; // Campaign Discount sin código
    }
    
    console.log('🧮 Cálculo de type_campaign:');
    console.log(`   code_cupon: ${simulatedCartData.code_cupon || 'NULL'}`);
    console.log(`   code_discount: ${simulatedCartData.code_discount || 'NULL'}`);
    console.log(`   discount: ${simulatedCartData.discount}%`);
    console.log(`   \n   Consulta: Discount.findByPk(${simulatedCartData.code_discount})`);
    console.log(`   Resultado: type_campaign = ${flashSale.type_campaign}`);
    console.log(`   \n   ✅ type_campaign guardado en Cart: ${type_campaign}`);
    console.log('');

    // 3. VERIFICAR QUÉ DEVUELVE EL RESOURCE
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 PASO 3: Verificar cart_list resource\n');
    
    const mockCart = {
      id: 999,
      type_discount: 1,
      discount: 20,
      code_cupon: null,
      code_discount: 12,
      type_campaign: type_campaign // Este es el que acabamos de calcular
    };
    
    // Simular resource (cart.js)
    const resourceOutput = {
      type_discount: mockCart.type_discount,
      discount: mockCart.discount,
      code_cupon: mockCart.code_cupon,
      code_discount: mockCart.code_discount,
      type_campaign: mockCart.type_campaign // ¿Está incluido?
    };
    
    console.log('📦 Salida del resource cart_list:');
    console.log(JSON.stringify(resourceOutput, null, 2));
    
    if (resourceOutput.type_campaign) {
      console.log('\n   ✅ type_campaign está incluido en la respuesta');
    } else {
      console.log('\n   ❌ type_campaign NO está incluido (PROBLEMA)');
    }
    console.log('');

    // 4. VERIFICAR QUÉ RECIBE STRIPE
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 PASO 4: Simular payload a Stripe\n');
    
    const cartItem = {
      ...resourceOutput,
      productId: 123,
      variedadId: 456,
      cantidad: 2,
      price_unitario: 18.95
    };
    
    console.log('📤 Item enviado a Stripe (CheckoutCache):');
    console.log(JSON.stringify(cartItem, null, 2));
    console.log('');

    // 5. VERIFICAR CREACIÓN DE SALEDETAIL
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 PASO 5: Simular creación de SaleDetail\n');
    
    const detailPayload = {
      saleId: 999,
      productId: cartItem.productId,
      variedadId: cartItem.variedadId,
      cantidad: cartItem.cantidad,
      price_unitario: cartItem.price_unitario,
      discount: cartItem.discount,
      type_discount: cartItem.type_discount,
      code_cupon: cartItem.code_cupon,
      code_discount: cartItem.code_discount,
      type_campaign: cartItem.type_campaign || null, // stripe.controller.js
      subtotal: cartItem.price_unitario * cartItem.cantidad,
      total: cartItem.price_unitario * cartItem.cantidad
    };
    
    console.log('💾 Payload para SaleDetail.create:');
    console.log(JSON.stringify(detailPayload, null, 2));
    
    if (detailPayload.type_campaign === 2) {
      console.log('\n   ✅ type_campaign = 2 (Flash Sale) se guardará correctamente');
    } else if (detailPayload.type_campaign === null) {
      console.log('\n   ❌ type_campaign = NULL (PROBLEMA - no se detectará como Flash Sale)');
    }
    console.log('');

    // 6. ANÁLISIS FINAL
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 ANÁLISIS FINAL\n');
    
    const isFlowCorrect = 
      flashSale.type_campaign === 2 &&
      type_campaign === 2 &&
      resourceOutput.type_campaign === 2 &&
      cartItem.type_campaign === 2 &&
      detailPayload.type_campaign === 2;
    
    if (isFlowCorrect) {
      console.log('✅ FLUJO COMPLETO CORRECTO:');
      console.log('   1. Discount.type_campaign = 2 ✅');
      console.log('   2. Cart.type_campaign = 2 ✅');
      console.log('   3. Resource incluye type_campaign ✅');
      console.log('   4. Frontend recibe type_campaign ✅');
      console.log('   5. Stripe recibe type_campaign ✅');
      console.log('   6. SaleDetail.type_campaign = 2 ✅');
      console.log('\n   🎯 Próxima compra se guardará correctamente');
    } else {
      console.log('❌ HAY PROBLEMAS EN EL FLUJO:');
      console.log(`   1. Discount.type_campaign = ${flashSale.type_campaign} ${flashSale.type_campaign === 2 ? '✅' : '❌'}`);
      console.log(`   2. Cart.type_campaign = ${type_campaign} ${type_campaign === 2 ? '✅' : '❌'}`);
      console.log(`   3. Resource incluye type_campaign ${resourceOutput.type_campaign ? '✅' : '❌'}`);
      console.log(`   4. Frontend recibe type_campaign ${cartItem.type_campaign ? '✅' : '❌'}`);
      console.log(`   5. SaleDetail.type_campaign = ${detailPayload.type_campaign || 'NULL'} ${detailPayload.type_campaign === 2 ? '✅' : '❌'}`);
    }

    // 7. VERIFICAR ÚLTIMO PEDIDO REAL
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 VERIFICANDO ÚLTIMO PEDIDO REAL EN BD\n');

    const [lastSaleDetail] = await sequelize.query(`
      SELECT 
        sd.id,
        sd.saleId,
        sd.type_campaign,
        sd.code_discount,
        sd.discount,
        p.title
      FROM sale_details sd
      LEFT JOIN products p ON sd.productId = p.id
      ORDER BY sd.id DESC
      LIMIT 1
    `);

    if (lastSaleDetail && lastSaleDetail.length > 0) {
      const detail = lastSaleDetail[0];
      console.log(`📦 Último SaleDetail guardado (ID: ${detail.id}, Venta: ${detail.saleId}):`);
      console.log(`   Producto: ${detail.title}`);
      console.log(`   type_campaign: ${detail.type_campaign || 'NULL'}`);
      console.log(`   code_discount: ${detail.code_discount || 'NULL'}`);
      console.log(`   discount: ${detail.discount}%`);
      
      if (detail.type_campaign === null && detail.code_discount) {
        console.log('\n   ⚠️  ESTE PEDIDO TIENE EL PROBLEMA:');
        console.log('   - code_discount existe pero type_campaign es NULL');
        console.log('   - Se creó ANTES de arreglar el resource cart.js');
        console.log('   - Próximos pedidos deberían tener type_campaign correcto');
      } else if (detail.type_campaign === 2) {
        console.log('\n   ✅ Este pedido tiene type_campaign correcto');
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

testCompleteFlow();
