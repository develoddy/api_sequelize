import { Sale } from '../src/models/Sale.js';
import { SaleDetail } from '../src/models/SaleDetail.js';
import { Variedad } from '../src/models/Variedad.js';
import '../src/models/Associations.js';

async function analyzeSales() {
    try {
        console.log('='.repeat(80));
        console.log('ANÁLISIS DE VENTAS #85 y #86');
        console.log('='.repeat(80));

        // Analizar venta #85 (Stripe)
        const sale85 = await Sale.findOne({
            where: { id: 85 },
            include: [{
                model: SaleDetail,
                include: [{ model: Variedad }]
            }]
        });

        if (sale85) {
            console.log('\n📊 VENTA #85 (STRIPE)');
            console.log('-'.repeat(50));
            console.log(`Método de pago: ${sale85.method_payment}`);
            console.log(`Total en BD: €${sale85.total}`);
            console.log(`Estado: ${sale85.status}`);
            console.log(`Fecha: ${sale85.createdAt}`);
            
            let calculatedTotal = 0;
            
            console.log('\n🛍️ PRODUCTOS:');
            // console.log('DEBUG - Sale data:', JSON.stringify(sale85, null, 2));
            
            if (sale85.sale_details && sale85.sale_details.length > 0) {
                for (const detail of sale85.sale_details) {
                    const variedad = detail.variedade;
                    console.log(`\n- ${variedad ? variedad.name : 'Sin nombre'}`);
                    console.log(`  Precio unitario final: €${detail.price_unitario}`);
                    console.log(`  Cantidad: ${detail.cantidad}`);
                    console.log(`  Precio total: €${detail.total}`);
                    console.log(`  Descuento: ${detail.discount}%`);
                    
                    calculatedTotal += parseFloat(detail.total);
                }
            } else {
                console.log('No se encontraron detalles de productos');
            }
            
            console.log(`\n💰 TOTAL CALCULADO: €${calculatedTotal.toFixed(2)}`);
            console.log(`💾 TOTAL EN BD: €${sale85.total}`);
            console.log(`✅ COINCIDEN: ${calculatedTotal.toFixed(2) === parseFloat(sale85.total).toFixed(2)}`);
        }

        // Analizar venta #86 (PayPal)
        const sale86 = await Sale.findOne({
            where: { id: 86 },
            include: [{
                model: SaleDetail,
                include: [{ model: Variedad }]
            }]
        });

        if (sale86) {
            console.log('\n\n📊 VENTA #86 (PAYPAL)');
            console.log('-'.repeat(50));
            console.log(`Método de pago: ${sale86.method_payment}`);
            console.log(`Total en BD: €${sale86.total}`);
            console.log(`Estado: ${sale86.status}`);
            console.log(`Fecha: ${sale86.createdAt}`);
            
            let calculatedTotal = 0;
            
            console.log('\n🛍️ PRODUCTOS:');
            
            if (sale86.sale_details && sale86.sale_details.length > 0) {
                for (const detail of sale86.sale_details) {
                    const variedad = detail.variedade;
                    console.log(`\n- ${variedad ? variedad.name : 'Sin nombre'}`);
                    console.log(`  Precio unitario final: €${detail.price_unitario}`);
                    console.log(`  Cantidad: ${detail.cantidad}`);
                    console.log(`  Precio total: €${detail.total}`);
                    console.log(`  Descuento: ${detail.discount}%`);
                    
                    calculatedTotal += parseFloat(detail.total);
                }
            } else {
                console.log('No se encontraron detalles de productos');
            }
            
            console.log(`\n💰 TOTAL CALCULADO: €${calculatedTotal.toFixed(2)}`);
            console.log(`💾 TOTAL EN BD: €${sale86.total}`);
            console.log(`✅ COINCIDEN: ${calculatedTotal.toFixed(2) === parseFloat(sale86.total).toFixed(2)}`);
        }

        // Comparación con datos del frontend mostrados
        console.log('\n\n📋 COMPARACIÓN CON FRONTEND:');
        console.log('='.repeat(50));
        
        if (sale85) {
            console.log('\n🔍 VENTA #85:');
            console.log('Frontend muestra: Total: €170.5');
            console.log(`Backend tiene: €${sale85.total}`);
            
            // Verificar productos específicos mencionados
            const expectedProducts85 = [
                { name: 'MUG TECH GITHUB', quantity: 3, unitPrice: 9.95, total: 29.85 },
                { name: 'GORRA TECH STYLE DOCKER', quantity: 2, unitPrice: 17.95, total: 35.90 },
                { name: 'CAMISETA DEV COFFEE TO CODE', quantity: 3, unitPrice: 20.95, total: 62.85 },
                { name: 'CAMISETA TECH LOW BATTERY', quantity: 2, unitPrice: 20.95, total: 41.90 }
            ];
            
            console.log('\n📦 PRODUCTOS ESPERADOS vs REALES:');
            for (const expected of expectedProducts85) {
                const actualDetail = sale85.sale_details.find(d => 
                    d.variedade.name.toLowerCase().includes(expected.name.toLowerCase()) ||
                    expected.name.toLowerCase().includes(d.variedade.name.toLowerCase())
                );
                
                if (actualDetail) {
                    console.log(`\n- ${expected.name}:`);
                    console.log(`  Esperado: ${expected.quantity} x €${expected.unitPrice} = €${expected.total}`);
                    console.log(`  Real: ${actualDetail.cantidad} x €${actualDetail.price_unitario} = €${actualDetail.total}`);
                    console.log(`  ✅ Cantidad OK: ${expected.quantity === actualDetail.cantidad}`);
                    console.log(`  ✅ Precio unitario OK: ${expected.unitPrice === parseFloat(actualDetail.price_unitario)}`);
                    console.log(`  ⚠️ Total esperado: €${expected.total} vs Real: €${actualDetail.total}`);
                } else {
                    console.log(`\n❌ No encontrado: ${expected.name}`);
                }
            }
        }

        if (sale86) {
            console.log('\n\n🔍 VENTA #86:');
            console.log('Frontend muestra: Total: €240.4');
            console.log(`Backend tiene: €${sale86.total}`);
            
            // Verificar algunos productos específicos
            console.log('\n📦 PRODUCTOS EN VENTA #86:');
            for (const detail of sale86.sale_details) {
                console.log(`- ${detail.variedade.name}: ${detail.cantidad} x €${detail.price_unitario} = €${detail.total} (${detail.discount}% desc.)`);
            }
            
            // Totales esperados según frontend
            const expectedTotal86 = 20.95 + 20.95 + 104.95 + 63.95 + 29.95; // 240.75
            console.log(`\n💰 TOTAL ESPERADO (suma manual): €${expectedTotal86.toFixed(2)}`);
        }

        console.log('\n' + '='.repeat(80));
        console.log('ANÁLISIS COMPLETADO');
        console.log('='.repeat(80));

    } catch (error) {
        console.error('Error analizando ventas:', error);
    } finally {
        process.exit(0);
    }
}

analyzeSales();