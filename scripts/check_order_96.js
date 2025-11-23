import { sequelize } from '../src/database/database.js';

async function checkOrder96() {
    try {
        console.log('\n=== ANÁLISIS PEDIDO #96 (Flash Sale 20%) ===\n');

        // Primero consulta directa de sale_details
        const detailsQuery = `
            SELECT * FROM sale_details WHERE saleId = 96;
        `;
        
        console.log('🔍 Consultando sale_details para saleId = 96...\n');
        const [details] = await sequelize.query(detailsQuery);
        
        if (details.length === 0) {
            console.log('❌ No se encontraron detalles para el Pedido #96');
            return;
        }
        
        console.log(`Encontrados ${details.length} detalles\n`);
        
        // Luego obtener información del producto
        for (const detail of details) {
            const productQuery = `
                SELECT title, price_usd FROM products WHERE id = ${detail.productId};
            `;
            const [products] = await sequelize.query(productQuery);
            const product = products[0];
            
            // Consultar la venta
            const saleQuery = `
                SELECT id, total, n_transaction FROM sales WHERE id = ${detail.saleId};
            `;
            const [sales] = await sequelize.query(saleQuery);
            const sale = sales[0];
            
            const row = {
                ...detail,
                product_name: product?.title || 'N/A',
                price_usd: product?.price_usd || 0,
                sale_id: sale?.id,
                sale_total: sale?.total,
                n_transaction: sale?.n_transaction
            };


            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log(`📦 PEDIDO #${row.sale_id} - DETALLE #${row.id}`);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log(`Producto: ${row.product_name}`);
            console.log(`Cantidad: ${row.cantidad}`);
            console.log('');
            
            console.log('💰 PRECIOS:');
            console.log(`  Precio Producto (price_usd): €${row.price_usd}`);
            console.log(`  Precio Final (price_unitario): €${row.price_unitario}`);
            console.log(`  Subtotal: €${row.subtotal}`);
            console.log(`  Total: €${row.total}`);
            console.log('');
            
            console.log('🎯 CAMPOS DE DESCUENTO:');
            console.log(`  type_discount: ${row.type_discount}`);
            console.log(`  discount: ${row.discount}`);
            console.log(`  code_cupon: ${row.code_cupon || 'NULL'}`);
            console.log(`  code_discount: ${row.code_discount || 'NULL'}`);
            console.log(`  type_campaign: ${row.type_campaign || 'NULL'} (1=Campaign, 2=Flash Sale, 3=Cupón)`);
            console.log('');

            // Calcular descuento real
            const originalPrice = parseFloat(row.price_usd);
            const finalPrice = parseFloat(row.price_unitario);
            const discountAmount = originalPrice - finalPrice;
            const discountPercentage = originalPrice > 0 ? ((discountAmount / originalPrice) * 100).toFixed(2) : 0;

            console.log('📊 CÁLCULO REAL:');
            console.log(`  Original: €${originalPrice.toFixed(2)}`);
            console.log(`  Final: €${finalPrice.toFixed(2)}`);
            console.log(`  Descuento: €${discountAmount.toFixed(2)} (${discountPercentage}%)`);
            console.log('');

            // Determinar tipo de descuento usando type_campaign
            console.log('🔍 TIPO DE DESCUENTO DETECTADO:');
            if (row.type_campaign === 3 || row.code_cupon) {
                console.log(`  ✅ CUPÓN: "${row.code_cupon || 'N/A'}"`);
            } else if (row.type_campaign === 2) {
                console.log(`  ✅ FLASH SALE: ${row.discount}% (ID: ${row.code_discount})`);
            } else if (row.type_campaign === 1) {
                console.log(`  ✅ CAMPAIGN DISCOUNT: ${row.discount}%`);
            } else if (discountAmount > 0) {
                console.log(`  ⚠️ DESCUENTO APLICADO pero type_campaign es NULL`);
            }
            console.log('');

            console.log('📋 RESUMEN VENTA:');
            console.log(`  Total Venta: €${row.sale_total}`);
            console.log(`  Transacción: ${row.n_transaction || 'N/A'}`);
            console.log('');
        }

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✅ Análisis completado');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    } catch (error) {
        console.error('❌ Error al analizar el pedido:', error.message);
        console.error(error);
    } finally {
        await sequelize.close();
    }
}

checkOrder96();
