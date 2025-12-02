'use strict';

/**
 * Migration: Add trackingToken field to Sales for secure public tracking
 * Campo para acceso seguro al tracking sin autenticación
 * 
 * @author Claude (GitHub Copilot)
 * @date 2025-12-01
 */

const crypto = require('crypto');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('🔒 Agregando campo trackingToken a Sales...');
    
    const tableInfo = await queryInterface.describeTable('sales');
    
    // Agregar trackingToken solo si no existe
    if (!tableInfo.trackingToken) {
      // Paso 1: Agregar columna como nullable inicialmente
      await queryInterface.addColumn('sales', 'trackingToken', {
        type: Sequelize.STRING(32),
        allowNull: true,
        unique: true,
        comment: 'Token único para acceso público al tracking (32 caracteres hex)'
      });
      console.log('   ✅ trackingToken agregado (nullable)');

      // Paso 2: Generar tokens para registros existentes
      const [sales] = await queryInterface.sequelize.query(
        'SELECT id FROM sales WHERE trackingToken IS NULL'
      );

      if (sales.length > 0) {
        console.log(`   🔄 Generando tokens para ${sales.length} ventas existentes...`);
        
        for (const sale of sales) {
          const token = crypto.randomBytes(16).toString('hex'); // 32 caracteres
          await queryInterface.sequelize.query(
            'UPDATE sales SET trackingToken = :token WHERE id = :id',
            {
              replacements: { token, id: sale.id }
            }
          );
        }
        console.log(`   ✅ Tokens generados para ${sales.length} ventas`);
      } else {
        console.log('   ℹ️  No hay ventas sin token');
      }

      // Paso 3: Cambiar columna a NOT NULL después de generar tokens
      await queryInterface.changeColumn('sales', 'trackingToken', {
        type: Sequelize.STRING(32),
        allowNull: false,
        unique: true,
        comment: 'Token único para acceso público al tracking (32 caracteres hex)'
      });
      console.log('   ✅ trackingToken cambiado a NOT NULL');

      // Paso 4: Crear índice para mejorar performance
      await queryInterface.addIndex('sales', ['trackingToken'], {
        name: 'idx_sales_tracking_token',
        unique: true
      });
      console.log('   ✅ Índice único creado en trackingToken');

    } else {
      console.log('   ⏭️  trackingToken ya existe, saltando...');
    }

    console.log('✅ Migración completada: trackingToken agregado a Sales');
  },

  async down(queryInterface, Sequelize) {
    console.log('🔄 Revirtiendo migración: Eliminando trackingToken de Sales...');
    
    const tableInfo = await queryInterface.describeTable('sales');
    
    if (tableInfo.trackingToken) {
      // Eliminar índice primero
      try {
        await queryInterface.removeIndex('sales', 'idx_sales_tracking_token');
        console.log('   ✅ Índice idx_sales_tracking_token eliminado');
      } catch (error) {
        console.log('   ⏭️  Índice no existe o ya fue eliminado');
      }

      // Eliminar columna
      await queryInterface.removeColumn('sales', 'trackingToken');
      console.log('   ✅ trackingToken eliminado');
    } else {
      console.log('   ⏭️  trackingToken no existe, saltando...');
    }

    console.log('✅ Reversión completada');
  }
};
