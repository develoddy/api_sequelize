import { sequelize } from '../src/database/database.js';

/**
 * Script para actualizar los sale_details existentes con el campo type_campaign
 * basándose en su code_discount consultando la tabla discounts
 */
async function updateSaleDetailsTypeCampaign() {
    try {
        console.log('\n=== ACTUALIZANDO SALE_DETAILS CON type_campaign ===\n');

        // Obtener todos los sale_details con descuento
        const [saleDetails] = await sequelize.query(`
            SELECT id, code_cupon, code_discount, discount
            FROM sale_details
            WHERE code_cupon IS NOT NULL OR code_discount IS NOT NULL OR discount > 0
        `);

        console.log(`✅ Encontrados ${saleDetails.length} detalles de venta con descuentos\n`);

        let updated = 0;
        let errors = 0;

        for (const detail of saleDetails) {
            try {
                let typeCampaign = null;

                // 1. Si tiene code_cupon, es Cupón (type_campaign = 3)
                if (detail.code_cupon) {
                    typeCampaign = 3;
                    console.log(`  📦 SaleDetail #${detail.id}: Cupón "${detail.code_cupon}" → type_campaign = 3`);
                }
                // 2. Si tiene code_discount, consultar la tabla discounts
                else if (detail.code_discount) {
                    const [discounts] = await sequelize.query(`
                        SELECT type_campaign FROM discounts WHERE id = ?
                    `, { replacements: [detail.code_discount] });

                    if (discounts.length > 0) {
                        typeCampaign = discounts[0].type_campaign;
                        const label = typeCampaign === 1 ? 'Campaign Discount' : 'Flash Sale';
                        console.log(`  📦 SaleDetail #${detail.id}: ${label} (ID: ${detail.code_discount}) → type_campaign = ${typeCampaign}`);
                    } else {
                        console.log(`  ⚠️  SaleDetail #${detail.id}: code_discount=${detail.code_discount} no encontrado en discounts`);
                    }
                }
                // 3. Si solo tiene discount sin código, es Campaign Discount sin código específico
                else if (detail.discount > 0) {
                    typeCampaign = 1;
                    console.log(`  📦 SaleDetail #${detail.id}: Campaign Discount sin código → type_campaign = 1`);
                }

                // Actualizar el sale_detail si se determinó el type_campaign
                if (typeCampaign !== null) {
                    await sequelize.query(`
                        UPDATE sale_details SET type_campaign = ? WHERE id = ?
                    `, { replacements: [typeCampaign, detail.id] });
                    updated++;
                }
            } catch (error) {
                console.error(`  ❌ Error actualizando sale_detail #${detail.id}:`, error.message);
                errors++;
            }
        }

        console.log(`\n✅ Actualización completada:`);
        console.log(`   - Actualizados: ${updated}`);
        console.log(`   - Errores: ${errors}`);
        console.log(`   - Total: ${saleDetails.length}\n`);

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await sequelize.close();
    }
}

updateSaleDetailsTypeCampaign();
