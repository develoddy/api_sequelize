import { SaleDetail } from '../src/models/SaleDetail.js';

async function fixSale88Subtotal() {
    try {
        console.log('='.repeat(60));
        console.log('CORRIGIENDO SUBTOTAL DE VENTA #88');
        console.log('='.repeat(60));

        // Corregir el SaleDetail ID 124 (GORRA TECH STYLE HTML5)
        const saleDetail124 = await SaleDetail.findByPk(124);
        
        if (saleDetail124) {
            console.log(`\n🔧 SaleDetail ID 124:`);
            console.log(`Precio unitario: €${saleDetail124.price_unitario}`);
            console.log(`Cantidad: ${saleDetail124.cantidad}`);
            console.log(`Subtotal actual: €${saleDetail124.subtotal}`);
            
            // Calcular el subtotal correcto
            const correctSubtotal = parseFloat((saleDetail124.price_unitario * saleDetail124.cantidad).toFixed(2));
            console.log(`Subtotal correcto: €${correctSubtotal}`);
            
            if (parseFloat(saleDetail124.subtotal) !== correctSubtotal) {
                console.log(`\n⚠️ Corrigiendo subtotal: €${saleDetail124.subtotal} → €${correctSubtotal}`);
                
                await SaleDetail.update({
                    subtotal: correctSubtotal
                }, {
                    where: { id: 124 }
                });
                
                console.log(`✅ Subtotal corregido para SaleDetail ID 124`);
            } else {
                console.log(`✅ Subtotal ya es correcto`);
            }
        } else {
            console.log(`❌ No se encontró SaleDetail ID 124`);
        }

        console.log('\n' + '='.repeat(60));
        console.log('✅ CORRECCIÓN COMPLETADA');
        console.log('='.repeat(60));

    } catch (error) {
        console.error('❌ Error corrigiendo subtotal:', error);
    } finally {
        process.exit(0);
    }
}

fixSale88Subtotal();