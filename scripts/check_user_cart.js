import { sequelize } from '../src/database/database.js';

/**
 * Script para verificar el estado del carrito del usuario
 */

const checkUserCart = async () => {
  try {
    console.log('🛒 VERIFICANDO CARRITO ACTUAL\n');

    // Buscar carritos activos
    const [carts] = await sequelize.query(`
      SELECT 
        c.id,
        c.userId,
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
      ORDER BY c.id DESC
      LIMIT 10
    `);

    if (!carts || carts.length === 0) {
      console.log('✅ No hay carritos activos\n');
      process.exit(0);
    }

    console.log(`📦 Encontrados ${carts.length} items en carritos:\n`);

    carts.forEach((cart, index) => {
      console.log(`${index + 1}. ${cart.product_title || 'Producto sin nombre'}`);
      console.log(`   Cart ID: ${cart.id}`);
      console.log(`   Usuario ID: ${cart.userId}`);
      console.log(`   type_campaign: ${cart.type_campaign || 'NULL'} ${cart.type_campaign === 2 ? '✅ (Flash Sale)' : cart.type_campaign === null ? '❌ (VIEJO)' : ''}`);
      console.log(`   discount: ${cart.discount}%`);
      console.log(`   code_discount: ${cart.code_discount || 'NULL'}`);
      console.log(`   Creado: ${cart.createdAt}`);
      console.log('');
    });

    const hasOldCarts = carts.some(c => c.type_campaign === null && c.code_discount);
    
    if (hasOldCarts) {
      console.log('⚠️  HAY CARRITOS VIEJOS SIN type_campaign');
      console.log('');
      console.log('📋 ACCIÓN REQUERIDA:');
      console.log('   1. Vacía tu carrito en el frontend');
      console.log('   2. Agrega nuevamente los productos');
      console.log('   3. Los nuevos items tendrán type_campaign correcto\n');
    } else {
      console.log('✅ Todos los carritos tienen type_campaign correcto\n');
    }

    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

checkUserCart();
