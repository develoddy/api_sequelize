'use strict';

/**
 * Migration: Add UNIQUE constraint to mailflow_email_logs
 * Author: MailFlow EXACTLY-ONCE DELIVERY System
 * Date: 2026-05-06
 * Purpose: GARANTIZAR exactly-once delivery eliminando duplicados a nivel DB
 * 
 * PROBLEMA RESUELTO:
 * - Race conditions en isEmailAlreadySent()
 * - Emails duplicados enviados en mismo batch
 * - Múltiples logs con mismo (sequenceId, contactId, emailIndex, status='sent')
 * 
 * SOLUCIÓN:
 * - UNIQUE constraint en (sequenceId, contactId, emailIndex, status)
 * - Database garantiza atomicidad
 * - INSERT fallará si ya existe registro sent/retry
 * 
 * CRÍTICO: Este constraint es la base del exactly-once delivery
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('📊 [MIGRATION] Añadiendo UNIQUE constraint para exactly-once delivery...');
    
    // PASO 1: Eliminar duplicados existentes antes de añadir constraint
    console.log('🧹 [MIGRATION] Limpiando duplicados existentes...');
    
    // Eliminar logs duplicados dejando solo el más reciente para cada (sequenceId, contactId, emailIndex, status='sent')
    await queryInterface.sequelize.query(`
      DELETE t1 FROM mailflow_email_logs t1
      INNER JOIN mailflow_email_logs t2 
      WHERE 
        t1.sequenceId = t2.sequenceId
        AND t1.contactId = t2.contactId
        AND t1.emailIndex = t2.emailIndex
        AND t1.status = t2.status
        AND t1.status = 'sent'
        AND t1.id < t2.id;
    `);
    
    console.log('✅ [MIGRATION] Duplicados eliminados');
    
    // PASO 2: Eliminar índice antiguo que NO era UNIQUE
    console.log('🗑️ [MIGRATION] Eliminando índice antiguo no-unique...');
    
    try {
      await queryInterface.removeIndex('mailflow_email_logs', 'idx_duplicate_check');
      console.log('✅ [MIGRATION] Índice antiguo eliminado');
    } catch (error) {
      console.log('⚠️ [MIGRATION] Índice antiguo no existía (OK)');
    }
    
    // PASO 3: Crear UNIQUE constraint
    console.log('🔒 [MIGRATION] Creando UNIQUE constraint...');
    
    // UNIQUE constraint en (sequenceId, contactId, emailIndex, status)
    // Esto garantiza que para cada combinación de sequence+contact+email,
    // solo puede haber UN registro con status='sent' o 'retry'
    await queryInterface.addIndex('mailflow_email_logs', 
      ['sequenceId', 'contactId', 'emailIndex', 'status'], 
      {
        unique: true,
        name: 'unique_email_delivery',
        where: {
          status: ['sent', 'retry'] // Solo aplicar a sent/retry, no a failed
        }
      }
    );
    
    console.log('✅ [MIGRATION] UNIQUE constraint creado');
    console.log('🎯 [MIGRATION] Exactly-once delivery GARANTIZADO a nivel DB');
    
    // PASO 4: Crear índice adicional para búsqueda rápida
    await queryInterface.addIndex('mailflow_email_logs', 
      ['sequenceId', 'contactId', 'emailIndex'], 
      {
        name: 'idx_email_lookup',
        unique: false
      }
    );
    
    console.log('✅ [MIGRATION] Índice de búsqueda rápida creado');
    console.log('✅ [MIGRATION] Migración completada exitosamente\n');
  },

  async down(queryInterface, Sequelize) {
    console.log('🔄 [MIGRATION] Revirtiendo cambios...');
    
    // Eliminar constraint único
    await queryInterface.removeIndex('mailflow_email_logs', 'unique_email_delivery');
    await queryInterface.removeIndex('mailflow_email_logs', 'idx_email_lookup');
    
    // Recrear índice antiguo (no-unique)
    await queryInterface.addIndex('mailflow_email_logs', 
      ['contactId', 'emailIndex', 'status'], 
      {
        name: 'idx_duplicate_check',
        unique: false
      }
    );
    
    console.log('✅ [MIGRATION] Rollback completado');
  }
};
