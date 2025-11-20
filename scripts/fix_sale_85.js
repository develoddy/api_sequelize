import { Sale } from '../src/models/Sale.js';
import { SaleDetail } from '../src/models/SaleDetail.js';
import { Variedad } from '../src/models/Variedad.js';
import '../src/models/Associations.js';

// Función para aplicar rounding .95 (igual que en los controladores)
function applyRoundingTo95(price) {
    const roundedPrice = Math.floor(price) + 0.95;
    return parseFloat(roundedPrice.toFixed(2));
}

async function fixSale85() {
    try {
        console.log('='.repeat(60));
        console.log('CORRIGIENDO VENTA #85');
        console.log('='.repeat(60));

        // Obtener la venta #85 con sus detalles
        const sale85 = await Sale.findOne({
            where: { id: 85 },
            include: [{
                model: SaleDetail,
                include: [{ model: Variedad }]
            }]
        });

        if (!sale85) {
            console.log('❌ No se encontró la venta #85');
            return;
        }

        console.log(`\n📊 VENTA #85 ENCONTRADA:`);
        console.log(`Total actual: €${sale85.total}`);
        console.log(`Productos: ${sale85.sale_details.length}`);

        let newTotal = 0;
        const corrections = [];

        console.log('\n🔧 CALCULANDO CORRECCIONES:');
        
        for (const detail of sale85.sale_details) {
            const variedad = detail.variedade;
            console.log(`\n- ${variedad.name}`);
            
            // Obtener precio original desde Variedad
            const originalPrice = parseFloat(variedad.retail_price);
            console.log(`  Precio original: €${originalPrice}`);
            
            // Calcular precio con descuento
            const discountAmount = (originalPrice * detail.discount) / 100;
            const discountedPrice = originalPrice - discountAmount;
            console.log(`  Descuento ${detail.discount}%: €${discountAmount.toFixed(2)}`);
            console.log(`  Precio con descuento: €${discountedPrice.toFixed(2)}`);
            
            // Aplicar .95 rounding al precio unitario
            const finalUnitPrice = applyRoundingTo95(discountedPrice);
            console.log(`  Precio final con .95: €${finalUnitPrice}`);
            
            // Calcular total del producto (exacto, sin rounding)
            const productTotal = finalUnitPrice * detail.cantidad;
            console.log(`  Total producto: ${detail.cantidad} x €${finalUnitPrice} = €${productTotal.toFixed(2)}`);
            
            // Comparar con valores actuales
            console.log(`  📋 ACTUAL vs CORRECTO:`);
            console.log(`     Precio unitario: €${detail.price_unitario} → €${finalUnitPrice}`);
            console.log(`     Total: €${detail.total} → €${productTotal.toFixed(2)}`);
            
            corrections.push({
                id: detail.id,
                currentUnitPrice: detail.price_unitario,
                newUnitPrice: finalUnitPrice,
                currentTotal: detail.total,
                newTotal: productTotal,
                needsUpdate: detail.price_unitario != finalUnitPrice || parseFloat(detail.total) != productTotal
            });
            
            newTotal += productTotal;
        }

        console.log(`\n💰 TOTAL CALCULADO: €${newTotal.toFixed(2)}`);
        console.log(`💾 TOTAL ACTUAL: €${sale85.total}`);
        console.log(`🔄 NECESITA CORRECCIÓN: ${parseFloat(sale85.total) !== parseFloat(newTotal.toFixed(2))}`);

        // Mostrar resumen de correcciones necesarias
        console.log('\n📋 RESUMEN DE CORRECCIONES:');
        const needsCorrection = corrections.filter(c => c.needsUpdate);
        
        if (needsCorrection.length === 0) {
            console.log('✅ No se necesitan correcciones');
            return;
        }

        console.log(`${needsCorrection.length} productos necesitan corrección:`);
        for (const correction of needsCorrection) {
            console.log(`- ID ${correction.id}: €${correction.currentUnitPrice} → €${correction.newUnitPrice}, Total: €${correction.currentTotal} → €${correction.newTotal.toFixed(2)}`);
        }

        // Confirmar antes de aplicar cambios
        console.log('\n⚠️  ¿Aplicar correcciones? (modificará la base de datos)');
        console.log('Cambiando valores automáticamente...');

        // Aplicar correcciones
        for (const correction of corrections) {
            if (correction.needsUpdate) {
                await SaleDetail.update({
                    price_unitario: correction.newUnitPrice,
                    total: correction.newTotal
                }, {
                    where: { id: correction.id }
                });
                console.log(`✅ Corregido SaleDetail ID ${correction.id}`);
            }
        }

        // Actualizar total de la venta
        if (parseFloat(sale85.total) !== parseFloat(newTotal.toFixed(2))) {
            await Sale.update({
                total: parseFloat(newTotal.toFixed(2))
            }, {
                where: { id: 85 }
            });
            console.log(`✅ Total de venta actualizado: €${sale85.total} → €${newTotal.toFixed(2)}`);
        }

        console.log('\n' + '='.repeat(60));
        console.log('✅ CORRECCIÓN COMPLETADA');
        console.log('='.repeat(60));

    } catch (error) {
        console.error('❌ Error corrigiendo venta #85:', error);
    } finally {
        process.exit(0);
    }
}

fixSale85();