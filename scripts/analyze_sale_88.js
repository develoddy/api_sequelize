import { Sale } from '../src/models/Sale.js';
import { SaleDetail } from '../src/models/SaleDetail.js';
import { Variedad } from '../src/models/Variedad.js';
import '../src/models/Associations.js';

async function analyzeSale88() {
    try {
        console.log('='.repeat(80));
        console.log('ANÁLISIS DE VENTA #88 (NUEVA COMPRA)');
        console.log('='.repeat(80));

        const sale88 = await Sale.findOne({
            where: { id: 88 },
            include: [{
                model: SaleDetail,
                include: [{ model: Variedad }]
            }]
        });

        if (sale88) {
            console.log(`\n📊 VENTA #88:`);
            console.log(`Método de pago: ${sale88.method_payment}`);
            console.log(`Total en BD: €${sale88.total}`);
            console.log(`Fecha: ${sale88.createdAt}`);
            
            let calculatedTotal = 0;
            
            console.log('\n🛍️ PRODUCTOS EN BASE DE DATOS:');
            for (const detail of sale88.sale_details) {
                const variedad = detail.variedade;
                console.log(`\n- ${variedad ? variedad.name : 'Sin nombre'}`);
                console.log(`  ID SaleDetail: ${detail.id}`);
                console.log(`  Precio unitario: €${detail.price_unitario}`);
                console.log(`  Cantidad: ${detail.cantidad}`);
                console.log(`  SUBTOTAL: €${detail.subtotal} ${detail.subtotal !== parseFloat((detail.price_unitario * detail.cantidad).toFixed(2)) ? '❌' : '✅'}`);
                console.log(`  TOTAL: €${detail.total} ${detail.total !== parseFloat((detail.price_unitario * detail.cantidad).toFixed(2)) ? '❌' : '✅'}`);
                console.log(`  Descuento: ${detail.discount}%`);
                console.log(`  Código: ${detail.code_cupon || detail.code_discount || 'N/A'}`);
                
                const expectedSubtotal = parseFloat((detail.price_unitario * detail.cantidad).toFixed(2));
                console.log(`  Esperado subtotal: €${expectedSubtotal}`);
                
                if (detail.subtotal !== expectedSubtotal) {
                    console.log(`  🔧 SUBTOTAL NECESITA CORRECCIÓN: €${detail.subtotal} → €${expectedSubtotal}`);
                }
                
                calculatedTotal += parseFloat(detail.total);
            }
            
            console.log(`\n💰 TOTAL CALCULADO: €${calculatedTotal.toFixed(2)}`);
            console.log(`💾 TOTAL EN BD: €${sale88.total}`);
            console.log(`✅ COINCIDEN: ${calculatedTotal.toFixed(2) === parseFloat(sale88.total).toFixed(2)}`);
            
            // Datos esperados del frontend
            console.log('\n📋 COMPARACIÓN CON FRONTEND:');
            console.log('Total mostrado: €53.85');
            console.log(`Total en BD: €${sale88.total}`);
            console.log(`✅ Frontend vs BD: ${53.85 === parseFloat(sale88.total)}`);
        }

        console.log('\n' + '='.repeat(80));
        console.log('ANÁLISIS COMPLETADO');
        console.log('='.repeat(80));

    } catch (error) {
        console.error('Error analizando venta #88:', error);
    } finally {
        process.exit(0);
    }
}

analyzeSale88();