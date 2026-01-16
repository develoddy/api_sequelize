#!/usr/bin/env node
/**
 * Script: Fix Production dashboard_route
 * 
 * Problema: En producción, mailflow tiene dashboard_route="/mailflow/dashboard"
 * pero esa ruta NO EXISTE (solo existe /mailflow y /mailflow/onboarding)
 * 
 * Solución: Actualizar a "/mailflow" (sin /dashboard)
 * 
 * Uso: node fix_production_dashboard_route.mjs
 */

import { Module } from './src/models/Module.js';
import dotenv from 'dotenv';
dotenv.config();

(async () => {
  try {
    console.log('🔍 Buscando módulos con dashboard_route incorrecto...\n');
    
    // Buscar todos los módulos SaaS
    const modules = await Module.findAll({
      where: {
        type: 'saas'
      }
    });
    
    if (modules.length === 0) {
      console.log('⚠️ No se encontraron módulos SaaS');
      process.exit(0);
    }
    
    console.log(`📦 Encontrados ${modules.length} módulos SaaS\n`);
    
    let fixed = 0;
    
    for (const module of modules) {
      if (!module.saas_config || !module.saas_config.dashboard_route) {
        console.log(`⏭️ ${module.key}: Sin dashboard_route configurado`);
        continue;
      }
      
      const original = module.saas_config.dashboard_route;
      let normalized = original;
      
      // Eliminar slashes iniciales y finales
      normalized = normalized.replace(/^\/+/, '').replace(/\/+$/, '');
      
      // Eliminar /dashboard al final
      normalized = normalized.replace(/\/dashboard$/, '');
      
      if (original !== normalized) {
        console.log(`🔧 ${module.key}:`);
        console.log(`   Antes: "${original}"`);
        console.log(`   Después: "${normalized}"`);
        
        // Actualizar
        module.saas_config = {
          ...module.saas_config,
          dashboard_route: normalized
        };
        
        await module.save();
        console.log(`   ✅ Actualizado\n`);
        fixed++;
      } else {
        console.log(`✓ ${module.key}: Ya está correcto ("${normalized}")`);
      }
    }
    
    console.log(`\n${'='.repeat(50)}`);
    console.log(`✨ Proceso completado`);
    console.log(`   Módulos revisados: ${modules.length}`);
    console.log(`   Módulos corregidos: ${fixed}`);
    console.log(`${'='.repeat(50)}\n`);
    
    if (fixed > 0) {
      console.log('💡 Ahora reinicia el servidor para que los cambios surtan efecto');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
})();
