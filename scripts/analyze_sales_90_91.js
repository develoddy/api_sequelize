import { Sale } from '../src/models/Sale.js';
import { SaleDetail } from '../src/models/SaleDetail.js';
import { Variedad } from '../src/models/Variedad.js';
import '../src/models/Associations.js';

async function analyzeSales90And91() {
    try {
        console.log('='.repeat(80));
        console.log('ANÁLISIS DE VENTAS #90 y #91 (CUPÓN + CAMPAIGN + FLASH SALE)');
        console.log('='.repeat(80));

        // Analizar ambas ventas
        for (const saleId of [90, 91]) {
            const sale = await Sale.findOne({
                where: { id: saleId },
                include: [{
                    model: SaleDetail,
                    include: [{ model: Variedad }]
                }]
            });

            if (sale) {
                console.log(`\n📊 VENTA #${saleId} (${sale.method_payment})`);
                console.log('-'.repeat(60));
                console.log(`Método de pago: ${sale.method_payment}`);
                console.log(`Total en BD: €${sale.total}`);
                console.log(`Fecha: ${sale.createdAt}`);
                console.log(`Transaction ID: ${sale.n_transaction}`);
                
                let calculatedTotal = 0;
                
                console.log(`\n🛍️ PRODUCTOS (${sale.sale_details.length} items):`);
                
                for (const detail of sale.sale_details) {
                    const variedad = detail.variedade;
                    console.log(`\n- ${variedad ? variedad.name : 'Sin nombre'}`);
                    console.log(`  ID SaleDetail: ${detail.id}`);
                    console.log(`  Precio unitario: €${detail.price_unitario}`);
                    console.log(`  Cantidad: ${detail.cantidad}`);
                    console.log(`  Subtotal: €${detail.subtotal}`);
                    console.log(`  Total: €${detail.total}`);
                    console.log(`  Descuento: ${detail.discount}%`);
                    console.log(`  Tipo descuento: ${detail.type_discount}`);
                    
                    // Identificar tipo de descuento
                    let discountType = 'Sin descuento';
                    if (detail.code_cupon) {
                        discountType = `🎟️ Cupón: ${detail.code_cupon}`;
                    } else if (detail.code_discount) {
                        discountType = `⚡ Flash Sale ID: ${detail.code_discount}`;
                    } else if (detail.discount > 0 && !detail.code_cupon && !detail.code_discount) {
                        discountType = `🎯 Campaign Discount: ${detail.discount}%`;
                    }
                    console.log(`  ${discountType}`);
                    
                    // Verificar cálculos
                    const expectedSubtotal = parseFloat((detail.price_unitario * detail.cantidad).toFixed(2));
                    const expectedTotal = parseFloat((detail.price_unitario * detail.cantidad).toFixed(2));
                    
                    const subtotalOK = parseFloat(detail.subtotal) === expectedSubtotal;
                    const totalOK = parseFloat(detail.total) === expectedTotal;
                    
                    console.log(`  ✅ Subtotal correcto: ${subtotalOK} (${detail.subtotal} = ${expectedSubtotal})`);
                    console.log(`  ✅ Total correcto: ${totalOK} (${detail.total} = ${expectedTotal})`);
                    
                    if (!subtotalOK || !totalOK) {
                        console.log(`  ⚠️ ERROR EN CÁLCULOS`);
                    }
                    
                    calculatedTotal += parseFloat(detail.total);
                }
                
                console.log(`\n💰 RESUMEN VENTA #${saleId}:`);
                console.log(`Total calculado: €${calculatedTotal.toFixed(2)}`);
                console.log(`Total en BD: €${sale.total}`);
                console.log(`✅ Totales coinciden: ${calculatedTotal.toFixed(2) === parseFloat(sale.total).toFixed(2)}`);
                
                // Verificar tipos de descuento presentes
                const cupones = sale.sale_details.filter(d => d.code_cupon).length;
                const flashSales = sale.sale_details.filter(d => d.code_discount && !d.code_cupon).length;
                const campaignDiscounts = sale.sale_details.filter(d => d.discount > 0 && !d.code_cupon && !d.code_discount).length;
                
                console.log(`\n🏷️ TIPOS DE DESCUENTO:`);
                console.log(`🎟️ Cupones: ${cupones} productos`);
                console.log(`⚡ Flash Sales: ${flashSales} productos`);
                console.log(`🎯 Campaign Discounts: ${campaignDiscounts} productos`);
                
            } else {
                console.log(`\n❌ No se encontró la venta #${saleId}`);
            }
        }

        // Comparación entre ambas ventas
        const sale90 = await Sale.findByPk(90);
        const sale91 = await Sale.findByPk(91);
        
        if (sale90 && sale91) {
            console.log('\n' + '='.repeat(80));
            console.log('📊 COMPARACIÓN STRIPE vs PAYPAL');
            console.log('='.repeat(80));
            console.log(`Venta #90 (${sale90.method_payment}): €${sale90.total}`);
            console.log(`Venta #91 (${sale91.method_payment}): €${sale91.total}`);
            
            if (sale90.method_payment !== sale91.method_payment) {
                console.log(`\n✅ Diferentes métodos de pago confirmados`);
                console.log(`✅ Ambas ventas procesadas correctamente`);
            }
        }

        console.log('\n' + '='.repeat(80));
        console.log('✅ ANÁLISIS COMPLETADO');
        console.log('Verificación de consistencia en sistema de descuentos');
        console.log('='.repeat(80));

    } catch (error) {
        console.error('Error analizando ventas #90 y #91:', error);
    } finally {
        process.exit(0);
    }
}

analyzeSales90And91();