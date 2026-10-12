#!/usr/bin/env node
/**
 * Script de diagnóstico para engagement rate
 * Verificar eventos metric_clicked, prevention_demo_viewed y module_type
 */

import '../../src/config/env.js';
import { sequelize } from '../../src/database/database.js';
import { QueryTypes } from 'sequelize';

async function checkEngagementRate() {
  try {
    console.log('\n🔧 Diagnóstico de Engagement Rate\n');
    console.log('='.repeat(60));
    
    // Query 1: Eventos críticos
    console.log('\n📊 Query 1: Eventos críticos (prevention_demo_viewed, metric_clicked, waitlist_success)');
    const events = await sequelize.query(
      `SELECT 
        event,
        COUNT(*) as count,
        COUNT(DISTINCT session_id) as unique_sessions
      FROM tracking_events
      WHERE module = 'inbox-zero-prevention'
        AND event IN ('prevention_demo_viewed', 'metric_clicked', 'waitlist_success')
      GROUP BY event
      ORDER BY event`,
      { type: QueryTypes.SELECT }
    );
    console.table(events);
    
    // Query 2: Detalles de metric_clicked
    console.log('\n📋 Query 2: Últimos 5 eventos metric_clicked');
    const metricClicks = await sequelize.query(
      `SELECT 
        id,
        event,
        session_id,
        properties,
        LEFT(user_agent, 50) as user_agent,
        created_at
      FROM tracking_events
      WHERE module = 'inbox-zero-prevention'
        AND event = 'metric_clicked'
      ORDER BY created_at DESC
      LIMIT 5`,
      { type: QueryTypes.SELECT }
    );
    console.table(metricClicks);
    
    // Query 3: Verificar module_type
    console.log('\n🔍 Query 3: Configuración del módulo');
    const moduleInfo = await sequelize.query(
      `SELECT 
        id, 
        name, 
        \`key\`, 
        module_type, 
        phase_order
      FROM modules
      WHERE \`key\` = 'inbox-zero-prevention'`,
      { type: QueryTypes.SELECT }
    );
    console.table(moduleInfo);
    
    // Query 4: Todos los eventos (para ver si hay prevention_demo_viewed)
    console.log('\n📈 Query 4: Todos los eventos del módulo (con conteo)');
    const allEvents = await sequelize.query(
      `SELECT 
        event,
        COUNT(*) as count,
        COUNT(DISTINCT session_id) as unique_sessions,
        MIN(created_at) as first_event,
        MAX(created_at) as last_event
      FROM tracking_events
      WHERE module = 'inbox-zero-prevention'
      GROUP BY event
      ORDER BY count DESC`,
      { type: QueryTypes.SELECT }
    );
    console.table(allEvents);
    
    // Query 5: Contar bots por user_agent
    console.log('\n🤖 Query 5: Detección de bots (Googlebot, crawler, spider)');
    const botEvents = await sequelize.query(
      `SELECT 
        CASE 
          WHEN user_agent LIKE '%Googlebot%' THEN 'Googlebot'
          WHEN user_agent LIKE '%bot%' THEN 'Generic Bot'
          WHEN user_agent LIKE '%Bot%' THEN 'Bot (uppercase)'
          WHEN user_agent LIKE '%crawler%' THEN 'Crawler'
          WHEN user_agent LIKE '%spider%' THEN 'Spider'
          ELSE 'Other'
        END as bot_type,
        COUNT(*) as count,
        COUNT(DISTINCT session_id) as unique_sessions
      FROM tracking_events
      WHERE module = 'inbox-zero-prevention'
        AND (
          user_agent LIKE '%Googlebot%' OR
          user_agent LIKE '%bot%' OR
          user_agent LIKE '%Bot%' OR
          user_agent LIKE '%crawler%' OR
          user_agent LIKE '%spider%'
        )
      GROUP BY bot_type
      ORDER BY count DESC`,
      { type: QueryTypes.SELECT }
    );
    console.table(botEvents);
    
    // Resumen
    console.log('\n' + '='.repeat(60));
    console.log('✅ Diagnóstico completado');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkEngagementRate();
