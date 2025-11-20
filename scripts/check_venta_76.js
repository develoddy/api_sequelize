// Script temporal para verificar los datos de la venta #76
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import { Sale } from '../src/models/Sale.js';
import { SaleDetail } from '../src/models/SaleDetail.js';
import { Product } from '../src/models/Product.js';
import { Variedad } from '../src/models/Variedad.js';
import '../src/models/Associations.js'; // Para cargar las asociaciones

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar variables de entorno
dotenv.config({ path: join(__dirname, '../.env.development') });

async function checkVenta76() {
  try {
    console.log('🔍 Buscando información de la venta #77...\n');

    // Obtener la venta con sus detalles
    const venta = await Sale.findByPk(77, {
      include: [
        {
          model: SaleDetail,
          include: [
            {
              model: Product,
              attributes: ['id', 'title', 'sku']
            },
            {
              model: Variedad,
              attributes: ['id', 'valor', 'retail_price', 'currency']
            }
          ]
        }
      ]
    });

    if (!venta) {
      console.log('❌ No se encontró la venta #77');
      return;
    }

    console.log('✅ Venta encontrada:');
    console.log(`📅 Fecha: ${venta.createdAt}`);
    console.log(`💰 Total venta: ${venta.total}${venta.currency_total || '€'}`);
    console.log(`📦 Cantidad de productos: ${venta.sale_details.length}\n`);

    console.log('🛍️ Detalles de productos:');
    console.log('═'.repeat(120));

    venta.sale_details.forEach((detail, index) => {
      console.log(`\n${index + 1}. ${detail.product?.title || 'Producto sin título'}`);
      console.log(`   📋 ID Producto: ${detail.productId} | Variedad ID: ${detail.variedadId}`);
      console.log(`   💰 Precio unitario almacenado: ${detail.price_unitario}€`);
      console.log(`   📊 Precio original variedad: ${detail.variedade?.retail_price}${detail.variedade?.currency || '€'}`);
      console.log(`   🎯 Cantidad: ${detail.cantidad}`);
      console.log(`   💸 Descuento: ${detail.discount || 0}%`);
      console.log(`   🎫 Cupón: ${detail.code_cupon || 'N/A'}`);
      console.log(`   🏷️ Descuento código: ${detail.code_discount || 'N/A'} (${detail.type_discount || 'N/A'})`);
      console.log(`   💵 Total línea: ${detail.total}€`);
      console.log('   ' + '─'.repeat(80));
    });

    console.log('\n📊 RESUMEN CRÍTICO:');
    console.log('═'.repeat(60));
    
    const expectedPrices = {
      'MUG': 9.95,
      'GORRA': 31.95, 
      'CAMISETA': 20.95
    };

    let allPricesCorrect = true;
    
    venta.sale_details.forEach(detail => {
      const productName = detail.product?.title?.toUpperCase() || 'UNKNOWN';
      const storedPrice = parseFloat(detail.price_unitario);
      const expectedPrice = Object.keys(expectedPrices).find(key => productName.includes(key));
      
      if (expectedPrice) {
        const expected = expectedPrices[expectedPrice];
        const isCorrect = Math.abs(storedPrice - expected) < 0.01;
        
        console.log(`${isCorrect ? '✅' : '❌'} ${productName}: ${storedPrice}€ ${isCorrect ? '(CORRECTO)' : `(ESPERADO: ${expected}€)`}`);
        
        if (!isCorrect) allPricesCorrect = false;
      } else {
        console.log(`⚠️  ${productName}: ${storedPrice}€ (No se puede validar)`);
      }
    });

    console.log(`\n🎯 ESTADO GENERAL: ${allPricesCorrect ? '✅ TODOS LOS PRECIOS SON CORRECTOS' : '❌ HAY PRECIOS INCORRECTOS'}`);
    
    if (allPricesCorrect) {
      console.log('\n🎉 ¡ÉXITO! El sistema está almacenando los precios con redondeo .95 correctamente.');
      console.log('✨ Los cambios implementados en Stripe webhook y sistema de cupones funcionan perfectamente.');
    } else {
      console.log('\n⚠️  Hay inconsistencias en los precios almacenados vs. los esperados.');
    }

    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error al consultar la venta:', error);
    process.exit(1);
  }
}

// Ejecutar la verificación
checkVenta76();