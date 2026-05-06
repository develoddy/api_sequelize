#!/usr/bin/env node

/**
 * Script para aplicar la migración de mailflow_email_logs
 * 
 * Uso: node apply-migration.mjs
 */

// ⚠️ IMPORTANTE: Cargar variables de entorno ANTES que cualquier otro módulo
import './src/config/env.js';

import { sequelize } from './src/database/database.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);
const MIGRATION_NAME = '20260506120000-create-mailflow-email-logs';

async function applyMigration() {
  console.log('📦 MailFlow Migration Tool\n');
  
  try {
    console.log('📄 Ejecutando migración con sequelize-cli...');
    
    // Ejecutar migración usando sequelize-cli
    const { stdout, stderr } = await execPromise('npm run db:migrate:dev');
    
    console.log(stdout);
    
    if (stderr && stderr.includes('ERROR')) {
      console.error('❌ Error ejecutando migración:', stderr);
      process.exit(1);
    }
    
    console.log('\n✅ Migración aplicada exitosamente\n');
    
    // Conectar y verificar la tabla
    console.log('🔌 Verificando tabla creada...');
    await sequelize.authenticate();
    
    try {
      const [structure] = await sequelize.query('DESCRIBE mailflow_email_logs');
      console.log('\n📊 Estructura de la tabla:');
      console.table(structure);
      
      console.log('\n📊 Verificando índices:');
      const [indexes] = await sequelize.query('SHOW INDEX FROM mailflow_email_logs');
      const indexSummary = indexes.reduce((acc, idx) => {
        if (!acc[idx.Key_name]) {
          acc[idx.Key_name] = [];
        }
        acc[idx.Key_name].push(idx.Column_name);
        return acc;
    }, {});
    
    console.log('\nÍndices creados:');
    Object.entries(indexSummary).forEach(([indexName, columns]) => {
      console.log(`   - ${indexName}: (${columns.join(', ')})`);
    });
    
    console.log('\n🎉 ¡Migración completada! El sistema está listo para usar.\n');
    
  } catch (error) {
    console.error('\n❌ Error aplicando migración:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

applyMigration();
