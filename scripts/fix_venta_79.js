// Script para corregir automáticamente la venta #79
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

function applyRoundingTo95(price) {
  if (!price || price <= 0) {
    return 0.95;
  }

  const integerPart = Math.floor(price);
  const decimalPart = price - integerPart;

  if (Math.abs(decimalPart - 0.95) < 0.001) {
    return parseFloat(price.toFixed(2));
  }

  if (decimalPart < 0.95) {
    return parseFloat((integerPart + 0.95).toFixed(2));
  } else {
    return parseFloat(((integerPart + 1) + 0.95).toFixed(2));
  }
}

async function fixVenta79() {
  try {
    console.log('🔧 Corrigiendo venta #79...\n');

    const venta = await Sale.findByPk(79, {
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
      console.log('❌ Venta #79 no encontrada');
      return;
    }

    console.log('📦 Procesando detalles...');
    let totalCorregido = 0;
    let cambios = 0;

    for (const detail of venta.sale_details) {
      const productName = detail.product?.title || 'Sin título';
      const precioActual = parseFloat(detail.price_unitario);
      const precioOriginal = parseFloat(detail.variedade?.retail_price || 0);
      const descuento = parseFloat(detail.discount || 0);
      
      console.log(`\n📝 ${productName}`);
      console.log(`   💰 Precio actual: ${precioActual}€`);
      console.log(`   📊 Precio original: ${precioOriginal}€`);
      console.log(`   📉 Descuento: ${descuento}%`);
      
      // Calcular precio correcto
      let precioConDescuento = precioOriginal;
      if (descuento > 0) {
        precioConDescuento = precioOriginal * (1 - descuento / 100);
      }
      
      const precioCorregido = applyRoundingTo95(precioConDescuento);
      console.log(`   ✨ Precio corregido: ${precioCorregido}€`);
      
      if (Math.abs(precioActual - precioCorregido) > 0.01) {
        console.log(`   🔧 ACTUALIZANDO de ${precioActual}€ a ${precioCorregido}€`);
        
        const nuevoTotal = precioCorregido * detail.cantidad;
        
        await detail.update({
          price_unitario: precioCorregido,
          total: nuevoTotal,
          subtotal: nuevoTotal
        });
        
        cambios++;
      } else {
        console.log(`   ✅ Ya es correcto`);
      }
      
      totalCorregido += precioCorregido * detail.cantidad;
    }

    if (cambios > 0) {
      console.log(`\n💰 Actualizando total de venta: ${totalCorregido.toFixed(2)}€`);
      
      await venta.update({
        total: parseFloat(totalCorregido.toFixed(2))
      });
    }

    console.log(`\n🎉 ¡Completado! Cambios: ${cambios}`);
    console.log(`💰 Total final: ${totalCorregido.toFixed(2)}€`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

fixVenta79();