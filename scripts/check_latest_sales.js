// Script para verificar la venta más reciente y sus precios
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

async function checkLatestSales() {
  try {
    console.log('🔍 Buscando las 3 ventas más recientes...\n');

    // Obtener las 3 ventas más recientes
    const ventas = await Sale.findAll({
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
      ],
      order: [['id', 'DESC']],
      limit: 3
    });

    if (!ventas || ventas.length === 0) {
      console.log('❌ No se encontraron ventas');
      return;
    }

    console.log(`✅ Encontradas ${ventas.length} ventas más recientes:\n`);

    ventas.forEach((venta, idx) => {
      console.log(`🛍️ VENTA #${venta.id} (${idx + 1}/${ventas.length})`);
      console.log(`📅 Fecha: ${venta.createdAt}`);
      console.log(`💰 Total: ${venta.total}€`);
      console.log(`💳 Método pago: ${venta.method_payment}`);
      console.log(`📦 Productos: ${venta.sale_details.length}`);
      
      // Si es la venta más reciente y tiene exactamente 3 productos con total 62.85, analizar en detalle
      if (idx === 0 && venta.sale_details.length === 3 && Math.abs(venta.total - 62.85) < 0.01) {
        console.log('\n🎯 ¡Esta parece ser la venta de prueba! Analizando en detalle...\n');
        
        const expectedPrices = {
          'MUG': 9.95,
          'GORRA': 31.95, 
          'CAMISETA': 20.95
        };

        let allPricesCorrect = true;
        
        venta.sale_details.forEach((detail, detailIdx) => {
          const productName = detail.product?.title || 'Producto desconocido';
          const storedPrice = parseFloat(detail.price_unitario);
          const originalPrice = parseFloat(detail.variedade?.retail_price || 0);
          const descuento = parseFloat(detail.discount || 0);
          
          console.log(`   ${detailIdx + 1}. ${productName}`);
          console.log(`      💰 Precio almacenado: ${storedPrice}€`);
          console.log(`      📊 Precio original: ${originalPrice}€`);
          console.log(`      📉 Descuento: ${descuento}%`);
          console.log(`      🎫 Cupón: ${detail.code_cupon || 'N/A'}`);
          console.log(`      🏷️ Código descuento: ${detail.code_discount || 'N/A'}`);
          
          // Verificar si el precio es correcto
          const expectedPrice = Object.keys(expectedPrices).find(key => productName.toUpperCase().includes(key));
          
          if (expectedPrice) {
            const expected = expectedPrices[expectedPrice];
            const isCorrect = Math.abs(storedPrice - expected) < 0.01;
            
            console.log(`      ${isCorrect ? '✅' : '❌'} Estado: ${isCorrect ? 'CORRECTO' : `INCORRECTO (esperado: ${expected}€)`}`);
            
            if (!isCorrect) allPricesCorrect = false;
          } else {
            console.log(`      ⚠️  No se puede validar automáticamente`);
          }
          console.log('');
        });
        
        console.log(`🎯 RESULTADO: ${allPricesCorrect ? '✅ TODOS LOS PRECIOS SON CORRECTOS' : '❌ HAY PRECIOS INCORRECTOS'}`);
        
        if (allPricesCorrect) {
          console.log('\n🎉 ¡PERFECTO! El nuevo sistema está funcionando correctamente.');
          console.log('✨ Los precios con redondeo .95 se están almacenando bien para:');
          console.log('   🎫 Cupones (BETA50 50%)');
          console.log('   ⚡ Flash Sales (10%)');
          console.log('   🏷️ Campaign Discounts (10%)');
        } else {
          console.log('\n⚠️  Hay inconsistencias. Revisar la implementación.');
        }
      } else {
        venta.sale_details.forEach((detail, detailIdx) => {
          console.log(`   ${detailIdx + 1}. ${detail.product?.title || 'Sin título'}: ${detail.price_unitario}€`);
        });
      }
      
      console.log('═'.repeat(80));
    });
    
  } catch (error) {
    console.error('❌ Error al consultar ventas:', error);
  } finally {
    process.exit(0);
  }
}

// Ejecutar la verificación
checkLatestSales();