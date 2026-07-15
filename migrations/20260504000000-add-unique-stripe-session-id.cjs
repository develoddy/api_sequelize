'use strict';

/**
 * Migration: Add UNIQUE index to stripeSessionId
 * Propósito: Prevenir duplicación de Sales por webhooks Stripe duplicados
 * Fecha: 2026-05-04
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('📌 [Migration] Añadiendo índice UNIQUE a stripeSessionId...');
    
    try {
      // Verificar si la columna stripeSessionId existe
      const tableDescription = await queryInterface.describeTable('sales');
      if (!tableDescription['stripeSessionId']) {
        console.warn('⚠️ [Migration] La columna stripeSessionId no existe en la tabla sales.');
        console.warn('⚠️ [Migration] Esta columna se crea por sync() en desarrollo o debe agregarse con una migración.');
        console.warn('⚠️ [Migration] Omitiendo creación de índice...');
        return;
      }
      
      // Verificar si ya existe el índice
      const [results] = await queryInterface.sequelize.query(
        "SHOW INDEX FROM sales WHERE Key_name = 'idx_stripe_session_id'"
      );
      
      if (results.length > 0) {
        console.log('⚠️ [Migration] Índice idx_stripe_session_id ya existe, omitiendo...');
        return;
      }
      
      // Limpiar duplicados existentes ANTES de crear el índice
      console.log('🔍 [Migration] Verificando duplicados existentes...');
      const [duplicates] = await queryInterface.sequelize.query(`
        SELECT stripeSessionId, COUNT(*) as count 
        FROM sales 
        WHERE stripeSessionId IS NOT NULL 
        GROUP BY stripeSessionId 
        HAVING count > 1
      `);
      
      if (duplicates.length > 0) {
        console.warn(`⚠️ [Migration] Encontrados ${duplicates.length} stripeSessionId duplicados`);
        console.warn('⚠️ [Migration] Por favor, limpiar manualmente antes de ejecutar esta migración');
        console.warn('⚠️ [Migration] Query para revisar duplicados:');
        console.warn('   SELECT * FROM sales WHERE stripeSessionId IN (SELECT stripeSessionId FROM sales WHERE stripeSessionId IS NOT NULL GROUP BY stripeSessionId HAVING COUNT(*) > 1);');
        throw new Error('Cannot add UNIQUE index: duplicate stripeSessionId values exist');
      }
      
      // Añadir índice UNIQUE (solo para valores no-null)
      await queryInterface.addIndex('sales', ['stripeSessionId'], {
        name: 'idx_stripe_session_id',
        unique: true,
        // MySQL permite múltiples NULL en UNIQUE index, perfecto para nuestro caso
      });
      
      console.log('✅ [Migration] Índice UNIQUE añadido exitosamente a stripeSessionId');
      
    } catch (error) {
      console.error('❌ [Migration] Error añadiendo índice UNIQUE:', error.message);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    console.log('🔄 [Migration] Eliminando índice UNIQUE de stripeSessionId...');
    
    try {
      // Verificar si el índice existe antes de intentar eliminarlo
      const [results] = await queryInterface.sequelize.query(
        "SHOW INDEX FROM sales WHERE Key_name = 'idx_stripe_session_id'"
      );
      
      if (results.length === 0) {
        console.log('⚠️ [Migration] Índice idx_stripe_session_id no existe, omitiendo...');
        return;
      }
      
      await queryInterface.removeIndex('sales', 'idx_stripe_session_id');
      console.log('✅ [Migration] Índice UNIQUE eliminado');
    } catch (error) {
      console.error('❌ [Migration] Error eliminando índice:', error.message);
      // No lanzar error si el índice simplemente no existe
      if (error.message.includes('check that it exists')) {
        console.log('⚠️ [Migration] El índice no existe, continuando...');
        return;
      }
      throw error;
    }
  }
};
