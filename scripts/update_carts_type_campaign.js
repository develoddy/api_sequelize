import { sequelize } from '../src/database/database.js';

/**
 * Script para actualizar los carts existentes con el campo type_campaign
 * basándose en su code_discount consultando la tabla discounts
 */
async function updateCartsTypeCampaign() {
    try {
        console.log('\n=== ACTUALIZANDO CARTS CON type_campaign ===\n');

        // Obtener todos los carts con descuento
        const [carts] = await sequelize.query(`
            SELECT id, code_cupon, code_discount, discount
            FROM carts
            WHERE code_cupon IS NOT NULL OR code_discount IS NOT NULL OR discount > 0
        `);

        console.log(`✅ Encontrados ${carts.length} carritos con descuentos\n`);

        let updated = 0;
        let errors = 0;

        for (const cart of carts) {
            try {
                let typeCampaign = null;

                // 1. Si tiene code_cupon, es Cupón (type_campaign = 3)
                if (cart.code_cupon) {
                    typeCampaign = 3;
                    console.log(`  📦 Cart #${cart.id}: Cupón "${cart.code_cupon}" → type_campaign = 3`);
                }
                // 2. Si tiene code_discount, consultar la tabla discounts
                else if (cart.code_discount) {
                    const [discounts] = await sequelize.query(`
                        SELECT type_campaign FROM discounts WHERE id = ?
                    `, { replacements: [cart.code_discount] });

                    if (discounts.length > 0) {
                        typeCampaign = discounts[0].type_campaign;
                        const label = typeCampaign === 1 ? 'Campaign Discount' : 'Flash Sale';
                        console.log(`  📦 Cart #${cart.id}: ${label} (ID: ${cart.code_discount}) → type_campaign = ${typeCampaign}`);
                    } else {
                        console.log(`  ⚠️  Cart #${cart.id}: code_discount=${cart.code_discount} no encontrado en discounts`);
                    }
                }
                // 3. Si solo tiene discount sin código, es Campaign Discount sin código específico
                else if (cart.discount > 0) {
                    typeCampaign = 1;
                    console.log(`  📦 Cart #${cart.id}: Campaign Discount sin código → type_campaign = 1`);
                }

                // Actualizar el cart si se determinó el type_campaign
                if (typeCampaign !== null) {
                    await sequelize.query(`
                        UPDATE carts SET type_campaign = ? WHERE id = ?
                    `, { replacements: [typeCampaign, cart.id] });
                    updated++;
                }
            } catch (error) {
                console.error(`  ❌ Error actualizando cart #${cart.id}:`, error.message);
                errors++;
            }
        }

        console.log(`\n✅ Actualización completada:`);
        console.log(`   - Actualizados: ${updated}`);
        console.log(`   - Errores: ${errors}`);
        console.log(`   - Total: ${carts.length}\n`);

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await sequelize.close();
    }
}

updateCartsTypeCampaign();
