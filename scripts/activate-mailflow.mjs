/**
 * Script: Activar y configurar MailFlow para producción
 */

import '../src/config/env.js';
import { Module } from '../src/models/Module.js';
import { Op } from 'sequelize';

async function activateMailflow() {
  try {
    console.log('🔍 Buscando módulo mailflow...\n');
    
    const module = await Module.findOne({
      where: { key: 'mailflow' }
    });
    
    if (!module) {
      console.log('❌ Módulo mailflow NO encontrado');
      process.exit(1);
    }
    
    console.log('📋 Estado actual:');
    console.log(`   Type: ${module.type}`);
    console.log(`   Active: ${module.is_active}`);
    console.log(`   Status: ${module.status}`);
    console.log(`   SaaS Config: ${module.saas_config ? 'YES' : 'NO'}\n`);
    
    // Actualizar a estado correcto
    await module.update({
      type: 'saas',
      is_active: true,
      status: 'live'
    });
    
    console.log('✅ Módulo actualizado correctamente\n');
    
    // Verificar con los mismos criterios del endpoint
    const verified = await Module.findOne({
      where: {
        key: 'mailflow',
        type: 'saas',
        is_active: true,
        status: {
          [Op.in]: ['testing', 'live']
        }
      }
    });
    
    if (verified) {
      console.log('✅ VERIFICACIÓN OK - Módulo cumple criterios del endpoint');
      console.log(`   ✓ type = 'saas'`);
      console.log(`   ✓ is_active = true`);
      console.log(`   ✓ status = '${verified.status}'`);
      console.log(`   ✓ saas_config = ${verified.saas_config ? 'configured' : 'missing'}`);
    } else {
      console.log('❌ VERIFICACIÓN FALLÓ - No cumple criterios');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

activateMailflow();
