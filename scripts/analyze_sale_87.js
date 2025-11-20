import { Sale } from '../src/models/Sale.js';
import { SaleDetail } from '../src/models/SaleDetail.js';
import { Variedad } from '../src/models/Variedad.js';
import '../src/models/Associations.js';

async function analyzeSale87() {
    try {
        console.log('='.repeat(80));
        console.log('ANÁLISIS DE VENTA #87 (STRIPE - NUEVA COMPRA)');
        console.log('='.repeat(80));

        // Analizar venta #87
        const sale87 = await Sale.findOne({
            where: { id: 87 },
            include: [{
                model: SaleDetail,
                include: [{ model: Variedad }]
            }]
        });

        if (!sale87) {
            console.log('❌ No se encontró la venta #87');
            console.log('Puede que aún no se haya procesado completamente.');
            return;
        }

        console.log('\n📊 VENTA #87 (STRIPE - NUEVA COMPRA)');
        console.log('-'.repeat(50));
        console.log(`Método de pago: ${sale87.method_payment}`);
        console.log(`Total en BD: €${sale87.total}`);
        console.log(`Fecha: ${sale87.createdAt}`);
        console.log(`Stripe Session ID: ${sale87.stripeSessionId || 'N/A'}`);
        
        let calculatedTotal = 0;
        
        console.log('\n🛍️ PRODUCTOS EN BASE DE DATOS:');
        if (sale87.sale_details && sale87.sale_details.length > 0) {
            for (const detail of sale87.sale_details) {
                const variedad = detail.variedade;
                console.log(`\n- ${variedad ? variedad.name : 'Sin nombre'}`);
                console.log(`  Precio unitario final: €${detail.price_unitario}`);
                console.log(`  Cantidad: ${detail.cantidad}`);
                console.log(`  Precio total: €${detail.total}`);
                console.log(`  Descuento: ${detail.discount}%`);
                console.log(`  Código cupón: ${detail.code_cupon || 'N/A'}`);
                console.log(`  Código descuento: ${detail.code_discount || 'N/A'}`);
                
                calculatedTotal += parseFloat(detail.total);
            }
        } else {
            console.log('No se encontraron detalles de productos');
        }
        
        console.log(`\n💰 TOTAL CALCULADO (suma productos): €${calculatedTotal.toFixed(2)}`);
        console.log(`💾 TOTAL EN BD: €${sale87.total}`);
        console.log(`✅ COINCIDEN: ${calculatedTotal.toFixed(2) === parseFloat(sale87.total).toFixed(2)}`);

        // Comparación con datos del frontend/checkout mostrados
        console.log('\n\n📋 COMPARACIÓN CON FRONTEND/CHECKOUT:');
        console.log('='.repeat(60));
        
        console.log('\n🔍 DATOS DEL CHECKOUT:');
        console.log('Total mostrado en checkout: €155.65');
        console.log(`Total guardado en BD: €${sale87.total}`);
        console.log(`✅ Totales coinciden: ${parseFloat(sale87.total) === 155.65}`);
        
        // Verificar productos específicos mencionados en el checkout
        const expectedProducts = [
            { name: 'CAMISETA DEV HELLO WORD', quantity: 4, unitPrice: 20.95, total: 83.80, discount: 10 },
            { name: 'MUG TECH GITHUB', quantity: 1, unitPrice: 18.95, total: 18.95, discount: 19 },
            { name: 'GORRA TECH STYLE HTML5', quantity: 1, unitPrice: 31.95, total: 31.95, discount: 10 },
            { name: 'CAMISETA DEV JS CHEERS', quantity: 1, unitPrice: 20.95, total: 20.95, discount: 10 }
        ];
        
        console.log('\n📦 PRODUCTOS ESPERADOS vs REALES:');
        let frontendTotal = 0;
        
        for (const expected of expectedProducts) {
            console.log(`\n🔍 ${expected.name}:`);
            console.log(`   Frontend: ${expected.quantity} x €${expected.unitPrice} = €${expected.total} (${expected.discount}% desc.)`);
            
            // Buscar el producto correspondiente en la BD
            const actualDetail = sale87.sale_details?.find(d => {
                const productName = d.variedade?.name || '';
                return productName.toLowerCase().includes(expected.name.toLowerCase()) ||
                       expected.name.toLowerCase().includes(productName.toLowerCase());
            });
            
            if (actualDetail) {
                console.log(`   BD Real:  ${actualDetail.cantidad} x €${actualDetail.price_unitario} = €${actualDetail.total} (${actualDetail.discount}% desc.)`);
                console.log(`   ✅ Cantidad: ${expected.quantity === actualDetail.cantidad ? 'OK' : 'ERROR'}`);
                console.log(`   ✅ Precio unitario: ${expected.unitPrice === parseFloat(actualDetail.price_unitario) ? 'OK' : 'ERROR'}`);
                console.log(`   ✅ Descuento: ${expected.discount === actualDetail.discount ? 'OK' : 'ERROR'}`);
                console.log(`   ✅ Total producto: ${expected.total === parseFloat(actualDetail.total) ? 'OK' : 'ERROR'}`);
            } else {
                console.log(`   ❌ No encontrado en BD`);
            }
            
            frontendTotal += expected.total;
        }
        
        console.log(`\n💰 TOTAL FRONTEND (suma manual): €${frontendTotal.toFixed(2)}`);
        console.log(`💰 TOTAL BD: €${sale87.total}`);
        console.log(`💰 TOTAL CALCULADO: €${calculatedTotal.toFixed(2)}`);
        
        // Verificar consistencia de .95 rounding
        console.log('\n🔄 VERIFICACIÓN DE .95 ROUNDING:');
        if (sale87.sale_details && sale87.sale_details.length > 0) {
            for (const detail of sale87.sale_details) {
                const unitPrice = parseFloat(detail.price_unitario);
                const hasCorrect95 = (unitPrice % 1).toFixed(2) === '0.95' || (unitPrice % 1).toFixed(2) === '0.00';
                console.log(`- ${detail.variedade?.name || 'Producto'}: €${unitPrice} ${hasCorrect95 ? '✅' : '⚠️'}`);
            }
        }

        console.log('\n' + '='.repeat(80));
        console.log('ANÁLISIS COMPLETADO');
        console.log('='.repeat(80));

        // Conclusión
        const isCorrect = calculatedTotal.toFixed(2) === parseFloat(sale87.total).toFixed(2) && 
                         parseFloat(sale87.total) === 155.65;
        
        console.log('\n🎯 CONCLUSIÓN:');
        if (isCorrect) {
            console.log('✅ ¡PERFECTO! La venta #87 se procesó correctamente');
            console.log('✅ Todos los cálculos son consistentes');
            console.log('✅ El sistema de Stripe funciona como esperado');
        } else {
            console.log('⚠️ Hay inconsistencias que requieren revisión');
        }

    } catch (error) {
        console.error('Error analizando venta #87:', error);
    } finally {
        process.exit(0);
    }
}

analyzeSale87();