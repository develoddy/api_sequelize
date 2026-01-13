/**
 * Script para resetear un tenant a modo trial
 * Uso: node scripts/reset-tenant-trial.mjs <email> <module_key>
 */

import { Sequelize } from 'sequelize';

const email = process.argv[2];
const moduleKey = process.argv[3];

if (!email || !moduleKey) {
  console.error('❌ Usage: node scripts/reset-tenant-trial.mjs <email> <module_key>');
  process.exit(1);
}

// Conexión a la base de datos local
const sequelize = new Sequelize(
  'ecommercedb',
  'root',
  '',
  {
    host: 'localhost',
    port: 3306,
    dialect: 'mysql',
    logging: false
  }
);

async function resetTenantTrial() {
  try {
    await sequelize.authenticate();
    console.log('✅ Connected to database');

    // Buscar tenant
    const [tenants] = await sequelize.query(
      'SELECT * FROM tenants WHERE email = ? AND module_key = ?',
      {
        replacements: [email, moduleKey]
      }
    );

    if (tenants.length === 0) {
      console.error(`❌ Tenant not found: ${email} (${moduleKey})`);
      process.exit(1);
    }

    const tenant = tenants[0];
    console.log(`\n📋 Tenant encontrado:`);
    console.log(`   ID: ${tenant.id}`);
    console.log(`   Email: ${tenant.email}`);
    console.log(`   Módulo: ${tenant.module_key}`);
    console.log(`   Status actual: ${tenant.status}`);
    console.log(`   Subscription ID: ${tenant.stripe_subscription_id || 'None'}`);

    // Resetear a trial
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14); // 14 días de trial

    await sequelize.query(
      `UPDATE tenants 
       SET status = 'trial',
           plan = 'trial',
           stripe_subscription_id = NULL,
           subscribed_at = NULL,
           trial_ends_at = ?,
           updated_at = NOW()
       WHERE id = ?`,
      {
        replacements: [trialEndsAt, tenant.id]
      }
    );

    console.log(`\n✅ Tenant reseteado a trial:`);
    console.log(`   Status: trial`);
    console.log(`   Plan: trial`);
    console.log(`   Trial ends at: ${trialEndsAt.toISOString()}`);
    console.log(`   Stripe subscription: Removed`);
    console.log(`\n⚠️  Recuerda cancelar la suscripción en Stripe Dashboard si aún está activa`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

resetTenantTrial();
