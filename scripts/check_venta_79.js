// Verificar precios de la venta #79
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

async function checkSale79() {
  try {
    const sale = await Sale.findByPk(79, {
      include: [{
        model: SaleDetail,
        include: [
          { model: Product, attributes: ['id', 'title'] },
          { model: Variedad, attributes: ['id', 'retail_price'] }
        ]
      }]
    });

    if (sale) {
      console.log('🔍 Venta #79 - Precios almacenados:');
      sale.sale_details.forEach((detail, i) => {
        console.log(`📦 Item ${i + 1}: ${detail.product.title}`);
        console.log(`   💰 price_unitario: ${detail.price_unitario}€`);
        console.log(`   📊 subtotal: ${detail.subtotal}€`);
        console.log(`   💵 total: ${detail.total}€`);
        console.log(`   📉 descuento: ${detail.discount}% (${detail.code_cupon || detail.code_discount || 'N/A'})`);
        console.log('');
      });
      console.log(`💰 Total venta: ${sale.total}€`);
    } else {
      console.log('❌ Venta #79 no encontrada');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  process.exit(0);
}

checkSale79();