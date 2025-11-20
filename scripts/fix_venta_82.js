// Script para corregir automáticamente la venta #82 (PayPal)
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
  return parseFloat((integerPart + 0.95).toFixed(2));
}

async function fixSale82() {
  try {
    console.log('🔧 Corrigiendo venta #82 (PayPal)...\n');

    // Obtener la venta con detalles
    const sale = await Sale.findByPk(82, {
      include: [{
        model: SaleDetail,
        include: [
          { model: Product, attributes: ['id', 'title', 'sku'] },
          { model: Variedad, attributes: ['id', 'retail_price'] }
        ]
      }]
    });

    if (!sale) {
      console.log('❌ Venta #82 no encontrada');
      return;
    }

    console.log('📦 Procesando detalles...\n');
    let totalChanges = 0;
    let newSaleTotal = 0;

    for (const detail of sale.sale_details) {
      const product = detail.product;
      const variedad = detail.variedade;
      
      console.log(`📝 ${product.title}`);
      console.log(`   💰 Precio actual: ${detail.price_unitario}€`);
      
      // Obtener precio original
      const originalPrice = parseFloat(variedad?.retail_price || 0);
      console.log(`   📊 Precio original: ${originalPrice}€`);
      
      // Calcular precio correcto
      let correctPrice = originalPrice;
      const hasDiscount = (detail.code_cupon || detail.code_discount || detail.discount > 0);
      
      if (hasDiscount) {
        const discountPercentage = parseFloat(detail.discount || 0);
        console.log(`   📉 Descuento: ${discountPercentage}%`);
        
        if (discountPercentage > 0) {
          const discountAmount = (originalPrice * discountPercentage) / 100;
          const calculatedPrice = originalPrice - discountAmount;
          correctPrice = applyRoundingTo95(calculatedPrice);
          
          console.log(`   🧮 Cálculo: ${originalPrice} - ${discountAmount.toFixed(2)} = ${calculatedPrice.toFixed(2)} → ${correctPrice}€`);
        }
      } else {
        correctPrice = applyRoundingTo95(originalPrice);
        console.log(`   ✨ Sin descuento, aplicando .95: ${originalPrice} → ${correctPrice}€`);
      }
      
      // Verificar si necesita corrección
      if (Math.abs(detail.price_unitario - correctPrice) > 0.01) {
        console.log(`   🔧 Corrigiendo: ${detail.price_unitario}€ → ${correctPrice}€`);
        
        // Actualizar el detalle
        await detail.update({
          price_unitario: correctPrice,
          subtotal: correctPrice * detail.cantidad,
          total: correctPrice * detail.cantidad
        });
        
        totalChanges++;
        console.log(`   ✅ Actualizado`);
      } else {
        console.log(`   ✅ Ya es correcto`);
      }
      
      newSaleTotal += correctPrice * detail.cantidad;
      console.log('');
    }

    // Actualizar total de la venta
    if (Math.abs(sale.total - newSaleTotal) > 0.01) {
      console.log(`💰 Actualizando total de venta: ${sale.total}€ → ${newSaleTotal}€`);
      await sale.update({ total: newSaleTotal });
    }

    console.log(`🎉 ¡Completado! Cambios: ${totalChanges}`);
    console.log(`💰 Total final: ${newSaleTotal}€`);

  } catch (error) {
    console.error('❌ Error:', error);
  }

  process.exit(0);
}

fixSale82();