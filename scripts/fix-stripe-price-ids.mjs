/**
 * Script para corregir los Price IDs intercambiados en la base de datos
 */

import { Sequelize } from 'sequelize';

const sequelize = new Sequelize('ecommercedb', 'root', '', {
  host: 'localhost',
  port: 3306,
  dialect: 'mysql',
  logging: false
});

async function fixPriceIds() {
  try {
    await sequelize.authenticate();
    console.log('✅ Conectado a la base de datos\n');

    // Obtener configuración actual
    const [modules] = await sequelize.query(
      "SELECT saas_config FROM modules WHERE module_key = 'mailflow'"
    );

    if (modules.length === 0) {
      console.error('❌ Módulo mailflow no encontrado');
      process.exit(1);
    }

    const saasConfig = JSON.parse(modules[0].saas_config);
    console.log('📋 Configuración actual:\n');
    saasConfig.pricing.forEach(plan => {
      console.log(`   ${plan.name}: ${plan.price}€ → ${plan.stripe_price_id}`);
    });

    // Intercambiar los Price IDs de Profesional y Business
    saasConfig.pricing.forEach(plan => {
      if (plan.name === 'Profesional') {
        console.log(`\n🔄 Corrigiendo ${plan.name}:`);
        console.log(`   Antes: ${plan.stripe_price_id} (79.99€ en Stripe)`);
        plan.stripe_price_id = 'price_1Sp9eNCtfffoVXXrSy2nnjhi';
        console.log(`   Después: ${plan.stripe_price_id} (29.99€ en Stripe)`);
      } else if (plan.name === 'Business') {
        console.log(`\n🔄 Corrigiendo ${plan.name}:`);
        console.log(`   Antes: ${plan.stripe_price_id} (29.99€ en Stripe)`);
        plan.stripe_price_id = 'price_1Sp9eNCtfffoVXXrPjCvFSsk';
        console.log(`   Después: ${plan.stripe_price_id} (79.99€ en Stripe)`);
      }
    });

    // Actualizar en la base de datos
    await sequelize.query(
      "UPDATE modules SET saas_config = ? WHERE module_key = 'mailflow'",
      {
        replacements: [JSON.stringify(saasConfig)]
      }
    );

    console.log('\n✅ Price IDs corregidos en la base de datos');
    console.log('\n📋 Nueva configuración:');
    saasConfig.pricing.forEach(plan => {
      console.log(`   ${plan.name}: ${plan.price}€ → ${plan.stripe_price_id}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

fixPriceIds();
