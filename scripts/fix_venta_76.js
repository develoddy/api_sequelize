// Script para corregir los precios incorrectos en la venta #76
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

/**
 * Aplica el algoritmo de redondeo hacia arriba al .95 más cercano
 * @param price Precio a redondear
 * @returns Precio redondeado terminado en .95
 */
function applyRoundingTo95(price) {
  if (!price || price <= 0) {
    return 0.95; // Precio mínimo
  }

  const integerPart = Math.floor(price);
  const decimalPart = price - integerPart;

  // Si ya termina en .95, mantenerlo
  if (Math.abs(decimalPart - 0.95) < 0.001) {
    return parseFloat(price.toFixed(2));
  }

  // Si el decimal es menor a .95, redondear al .95 del mismo entero
  // Si es mayor o igual a .95, redondear al .95 del siguiente entero
  if (decimalPart < 0.95) {
    return parseFloat((integerPart + 0.95).toFixed(2));
  } else {
    return parseFloat(((integerPart + 1) + 0.95).toFixed(2));
  }
}

async function fixVenta76Prices() {
  try {
    console.log('🔧 Corrigiendo precios de la venta #76...\n');

    // Obtener la venta con sus detalles
    const venta = await Sale.findByPk(76, {
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
      console.log('❌ No se encontró la venta #76');
      return;
    }

    console.log('📦 Procesando detalles de venta...');
    let totalCorregido = 0;
    let cambiosRealizados = 0;

    for (const detail of venta.sale_details) {
      const productName = detail.product?.title || 'Producto desconocido';
      const precioActual = parseFloat(detail.price_unitario);
      const precioOriginal = parseFloat(detail.variedade?.retail_price || 0);
      const descuento = parseFloat(detail.discount || 0);
      
      console.log(`\n📝 Procesando: ${productName}`);
      console.log(`   💰 Precio original: ${precioOriginal}€`);
      console.log(`   📉 Descuento: ${descuento}%`);
      console.log(`   💸 Precio actual almacenado: ${precioActual}€`);
      
      // Calcular el precio correcto con descuento y redondeo .95
      let precioConDescuento = precioOriginal;
      
      if (descuento > 0) {
        // Aplicar descuento porcentual
        precioConDescuento = precioOriginal * (1 - descuento / 100);
      }
      
      // Aplicar redondeo .95
      const precioCorregido = applyRoundingTo95(precioConDescuento);
      
      console.log(`   🎯 Precio calculado con descuento: ${precioConDescuento.toFixed(2)}€`);
      console.log(`   ✨ Precio corregido con redondeo .95: ${precioCorregido}€`);
      
      // Solo actualizar si es diferente
      if (Math.abs(precioActual - precioCorregido) > 0.01) {
        console.log(`   🔧 ACTUALIZANDO de ${precioActual}€ a ${precioCorregido}€`);
        
        // Calcular nuevo total
        const nuevoTotal = precioCorregido * detail.cantidad;
        
        // Actualizar en la base de datos
        await detail.update({
          price_unitario: precioCorregido,
          total: nuevoTotal,
          subtotal: nuevoTotal
        });
        
        cambiosRealizados++;
      } else {
        console.log(`   ✅ Ya es correcto, no necesita cambios`);
      }
      
      totalCorregido += precioCorregido * detail.cantidad;
    }

    // Actualizar el total de la venta
    if (cambiosRealizados > 0) {
      console.log(`\n💰 Actualizando total de venta de ${venta.total}€ a ${totalCorregido.toFixed(2)}€`);
      
      await venta.update({
        total: parseFloat(totalCorregido.toFixed(2))
      });
    }

    console.log(`\n🎉 ¡Corrección completada!`);
    console.log(`📊 Cambios realizados: ${cambiosRealizados} productos`);
    console.log(`💰 Nuevo total de venta: ${totalCorregido.toFixed(2)}€`);
    
    if (cambiosRealizados > 0) {
      console.log('\n✨ Los precios ahora están consistentes con el sistema de redondeo .95');
    } else {
      console.log('\n👍 Todos los precios ya estaban correctos');
    }
    
  } catch (error) {
    console.error('❌ Error al corregir la venta:', error);
  } finally {
    process.exit(0);
  }
}

// Ejecutar la corrección
fixVenta76Prices();