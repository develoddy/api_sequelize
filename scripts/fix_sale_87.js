import { Sale } from '../src/models/Sale.js';
import { SaleDetail } from '../src/models/SaleDetail.js';
import { Variedad } from '../src/models/Variedad.js';
import '../src/models/Associations.js';

// Función para aplicar rounding .95 (igual que en los controladores)
function applyRoundingTo95(price) {
    const roundedPrice = Math.floor(price) + 0.95;
    return parseFloat(roundedPrice.toFixed(2));
}

async function fixSale87() {
    try {
        console.log('='.repeat(60));
        console.log('CORRIGIENDO VENTA #87 (STRIPE)');
        console.log('='.repeat(60));

        // Obtener la venta #87 con sus detalles
        const sale87 = await Sale.findOne({
            where: { id: 87 },
            include: [{
                model: SaleDetail,
                include: [{ model: Variedad }]
            }]
        });

        if (!sale87) {
            console.log('❌ No se encontró la venta #87');
            return;
        }

        console.log(`\n📊 VENTA #87 ENCONTRADA:`);
        console.log(`Total actual: €${sale87.total}`);
        console.log(`Productos: ${sale87.sale_details.length}`);

        let newTotal = 0;
        const corrections = [];

        console.log('\n🔧 CALCULANDO CORRECCIONES:');
        
        for (const detail of sale87.sale_details) {
            const variedad = detail.variedade;
            console.log(`\n- ${variedad.name}`);
            
            // El precio unitario ya está correcto (€20.95, €31.95, etc.)
            const unitPrice = parseFloat(detail.price_unitario);
            console.log(`  Precio unitario: €${unitPrice} ✅`);
            
            // Calcular total del producto (exacto, sin decimales raros)
            const productTotal = parseFloat((unitPrice * detail.cantidad).toFixed(2));
            console.log(`  Total producto: ${detail.cantidad} x €${unitPrice} = €${productTotal}`);
            
            // Comparar con valor actual
            console.log(`  📋 ACTUAL vs CORRECTO:`);
            console.log(`     Total: €${detail.total} → €${productTotal}`);
            
            corrections.push({
                id: detail.id,
                currentTotal: detail.total,
                newTotal: productTotal,
                needsUpdate: parseFloat(detail.total) !== productTotal
            });
            
            newTotal += productTotal;
        }

        console.log(`\n💰 TOTAL CALCULADO: €${newTotal.toFixed(2)}`);
        console.log(`💾 TOTAL ACTUAL: €${sale87.total}`);
        console.log(`🔄 NECESITA CORRECCIÓN: ${parseFloat(sale87.total) !== parseFloat(newTotal.toFixed(2))}`);

        // Mostrar resumen de correcciones necesarias
        console.log('\n📋 RESUMEN DE CORRECCIONES:');
        const needsCorrection = corrections.filter(c => c.needsUpdate);
        
        if (needsCorrection.length === 0) {
            console.log('✅ No se necesitan correcciones');
            return;
        }

        console.log(`${needsCorrection.length} productos necesitan corrección:`);
        for (const correction of needsCorrection) {
            console.log(`- ID ${correction.id}: Total €${correction.currentTotal} → €${correction.newTotal}`);
        }

        console.log('\n⚠️  Aplicando correcciones automáticamente...');

        // Aplicar correcciones
        for (const correction of corrections) {
            if (correction.needsUpdate) {
                await SaleDetail.update({
                    total: correction.newTotal
                }, {
                    where: { id: correction.id }
                });
                console.log(`✅ Corregido SaleDetail ID ${correction.id}: €${correction.currentTotal} → €${correction.newTotal}`);
            }
        }

        // Verificar si el total de la venta necesita actualización
        if (parseFloat(sale87.total) !== parseFloat(newTotal.toFixed(2))) {
            console.log(`\n⚠️ El total de la venta también necesita corrección:`);
            console.log(`   Actual: €${sale87.total} → Correcto: €${newTotal.toFixed(2)}`);
            
            await Sale.update({
                total: parseFloat(newTotal.toFixed(2))
            }, {
                where: { id: 87 }
            });
            console.log(`✅ Total de venta actualizado: €${sale87.total} → €${newTotal.toFixed(2)}`);
        } else {
            console.log('\n✅ El total de la venta ya es correcto');
        }

        console.log('\n' + '='.repeat(60));
        console.log('✅ CORRECCIÓN COMPLETADA');
        console.log('Todos los totales ahora son exactos (sin decimales extraños)');
        console.log('='.repeat(60));

    } catch (error) {
        console.error('❌ Error corrigiendo venta #87:', error);
    } finally {
        process.exit(0);
    }
}

fixSale87();