// Script para verificar la venta #78
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import { Sale } from '../src/models/Sale.js';
import { SaleDetail } from '../src/models/SaleDetail.js';
import { Product } from '../src/models/Product.js';
import { Variedad } from '../src/models/Variedad.js';
import '../src/models/Associations.js'; 

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env.development') });

async function checkVenta78() {
  try {
    console.log('🔍 Verificando venta #78...\n');

    const venta = await Sale.findByPk(78, {
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
      console.log('❌ No se encontró la venta #78');
      return;
    }

    console.log('✅ Venta encontrada:');
    console.log(`📅 Fecha: ${venta.createdAt}`);
    console.log(`💰 Total: ${venta.total}€`);
    console.log(`📦 Productos: ${venta.sale_details.length}\n`);

    const expectedPrices = {
      'MUG': 9.95,
      'GORRA': 31.95, 
      'CAMISETA': 20.95
    };

    let allPricesCorrect = true;
    
    console.log('📋 ANÁLISIS DE PRECIOS:');
    console.log('═'.repeat(60));

    venta.sale_details.forEach((detail, index) => {
      const productName = detail.product?.title || 'Producto desconocido';
      const storedPrice = parseFloat(detail.price_unitario);
      const originalPrice = parseFloat(detail.variedade?.retail_price || 0);
      const descuento = parseFloat(detail.discount || 0);
      
      console.log(`\n${index + 1}. ${productName}`);
      console.log(`   💰 Precio almacenado: ${storedPrice}€`);
      console.log(`   📊 Precio original: ${originalPrice}€`);
      console.log(`   📉 Descuento: ${descuento}%`);
      console.log(`   🎫 Cupón: ${detail.code_cupon || 'N/A'}`);
      console.log(`   🏷️ Flash/Campaign ID: ${detail.code_discount || 'N/A'}`);
      
      // Verificar si el precio es correcto
      const expectedPrice = Object.keys(expectedPrices).find(key => 
        productName.toUpperCase().includes(key)
      );
      
      if (expectedPrice) {
        const expected = expectedPrices[expectedPrice];
        const isCorrect = Math.abs(storedPrice - expected) < 0.01;
        
        console.log(`   ${isCorrect ? '✅' : '❌'} Estado: ${isCorrect ? 'CORRECTO' : `INCORRECTO (esperado: ${expected}€)`}`);
        
        if (!isCorrect) allPricesCorrect = false;
      }
    });

    console.log(`\n🎯 RESULTADO: ${allPricesCorrect ? '✅ CORRECTO' : '❌ NECESITA CORRECCIÓN'}`);
    
    if (!allPricesCorrect) {
      console.log('\n🔧 Se necesita aplicar corrección de redondeo .95');
      console.log('💡 Los logs del webhook nos dirán exactamente qué datos recibió del frontend');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

checkVenta78();