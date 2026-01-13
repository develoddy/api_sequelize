/**
 * Migración: Agregar campos cancelled_at y subscription_ends_at a tenants
 * 
 * Uso: node migrations/add-tenant-cancel-fields.mjs
 */

import { Sequelize } from 'sequelize';

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

async function migrate() {
  try {
    console.log('🔄 Running migration: Add cancelled_at and subscription_ends_at to tenants...\n');

    await sequelize.authenticate();
    console.log('✅ Connected to database');

    // Verificar si la columna ya existe
    const [columns] = await sequelize.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'ecommercedb' 
        AND TABLE_NAME = 'tenants'
        AND COLUMN_NAME IN ('cancelled_at', 'subscription_ends_at')
    `);

    const existingColumns = columns.map(c => c.COLUMN_NAME);

    // Agregar cancelled_at si no existe
    if (!existingColumns.includes('cancelled_at')) {
      console.log('📝 Adding column: cancelled_at');
      await sequelize.query(`
        ALTER TABLE tenants 
        ADD COLUMN cancelled_at DATETIME NULL AFTER subscribed_at
      `);
      console.log('✅ Column cancelled_at added');
    } else {
      console.log('⏭️  Column cancelled_at already exists');
    }

    // Agregar subscription_ends_at si no existe
    if (!existingColumns.includes('subscription_ends_at')) {
      console.log('📝 Adding column: subscription_ends_at');
      await sequelize.query(`
        ALTER TABLE tenants 
        ADD COLUMN subscription_ends_at DATETIME NULL AFTER cancelled_at
      `);
      console.log('✅ Column subscription_ends_at added');
    } else {
      console.log('⏭️  Column subscription_ends_at already exists');
    }

    console.log('\n✅ Migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

migrate();
