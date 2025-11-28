'use strict';

/**
 * Migration: Add Printful tracking and error handling fields to Sales
 * Campos para manejo completo de webhooks y tracking de envíos
 * 
 * @author Claude (GitHub Copilot)
 * @date 2025-11-28
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('📦 Agregando campos de tracking y error handling a Sales...');
    
    const tableInfo = await queryInterface.describeTable('sales');
    
    // Agregar trackingNumber solo si no existe
    if (!tableInfo.trackingNumber) {
      await queryInterface.addColumn('sales', 'trackingNumber', {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Número de tracking del envío (ej: 1Z999AA10123456784)'
      });
      console.log('   ✅ trackingNumber agregado');
    } else {
      console.log('   ⏭️  trackingNumber ya existe, saltando...');
    }

    // Agregar trackingUrl solo si no existe
    if (!tableInfo.trackingUrl) {
      await queryInterface.addColumn('sales', 'trackingUrl', {
        type: Sequelize.STRING(500),
        allowNull: true,
        comment: 'URL de seguimiento del paquete'
      });
      console.log('   ✅ trackingUrl agregado');
    } else {
      console.log('   ⏭️  trackingUrl ya existe, saltando...');
    }

    // Agregar carrier solo si no existe
    if (!tableInfo.carrier) {
      await queryInterface.addColumn('sales', 'carrier', {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Transportista (DHL, UPS, FedEx, USPS, etc.)'
      });
      console.log('   ✅ carrier agregado');
    } else {
      console.log('   ⏭️  carrier ya existe, saltando...');
    }

    // Agregar shippedAt solo si no existe
    if (!tableInfo.shippedAt) {
      await queryInterface.addColumn('sales', 'shippedAt', {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Fecha y hora de envío del paquete'
      });
      console.log('   ✅ shippedAt agregado');
    } else {
      console.log('   ⏭️  shippedAt ya existe, saltando...');
    }

    // Agregar errorMessage solo si no existe
    if (!tableInfo.errorMessage) {
      await queryInterface.addColumn('sales', 'errorMessage', {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Mensaje de error si el pedido falla en Printful'
      });
      console.log('   ✅ errorMessage agregado');
    } else {
      console.log('   ⏭️  errorMessage ya existe, saltando...');
    }

    // Agregar syncStatus solo si no existe
    if (!tableInfo.syncStatus) {
      await queryInterface.addColumn('sales', 'syncStatus', {
        type: Sequelize.ENUM('pending', 'failed', 'shipped', 'canceled', 'fulfilled'),
        allowNull: true,
        defaultValue: 'pending',
        comment: 'Estado de sincronización con Printful'
      });
      console.log('   ✅ syncStatus agregado');
    } else {
      console.log('   ⏭️  syncStatus ya existe, saltando...');
    }

    // Agregar completedAt solo si no existe
    if (!tableInfo.completedAt) {
      await queryInterface.addColumn('sales', 'completedAt', {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Fecha de finalización del pedido (fulfilled)'
      });
      console.log('   ✅ completedAt agregado');
    } else {
      console.log('   ⏭️  completedAt ya existe, saltando...');
    }

    console.log('📌 Creando índices en Sales...');

    // Obtener índices existentes
    const indexes = await queryInterface.showIndex('sales');
    const existingIndexNames = indexes.map(idx => idx.name);

    // Índice para búsquedas por tracking number
    if (!existingIndexNames.includes('idx_sales_tracking_number')) {
      await queryInterface.addIndex('sales', ['trackingNumber'], {
        name: 'idx_sales_tracking_number'
      });
      console.log('   ✅ idx_sales_tracking_number creado');
    } else {
      console.log('   ⏭️  idx_sales_tracking_number ya existe, saltando...');
    }

    // Índice para filtrar por syncStatus
    if (!existingIndexNames.includes('idx_sales_sync_status')) {
      await queryInterface.addIndex('sales', ['syncStatus'], {
        name: 'idx_sales_sync_status'
      });
      console.log('   ✅ idx_sales_sync_status creado');
    } else {
      console.log('   ⏭️  idx_sales_sync_status ya existe, saltando...');
    }

    // Índice compuesto: syncStatus + shippedAt (sin errorMessage para evitar límite de tamaño)
    if (!existingIndexNames.includes('idx_sales_sync_status_shipped')) {
      await queryInterface.addIndex('sales', ['syncStatus', 'shippedAt'], {
        name: 'idx_sales_sync_status_shipped'
      });
      console.log('   ✅ idx_sales_sync_status_shipped creado');
    } else {
      console.log('   ⏭️  idx_sales_sync_status_shipped ya existe, saltando...');
    }

    console.log('✅ Campos de tracking agregados exitosamente');
  },

  async down(queryInterface, Sequelize) {
    console.log('🗑️  Eliminando campos de tracking de Sales...');
    
    // Eliminar índices primero
    await queryInterface.removeIndex('sales', 'idx_sales_tracking_number');
    await queryInterface.removeIndex('sales', 'idx_sales_sync_status');
    await queryInterface.removeIndex('sales', 'idx_sales_sync_status_shipped');
    
    // Eliminar columnas
    await queryInterface.removeColumn('sales', 'trackingNumber');
    await queryInterface.removeColumn('sales', 'trackingUrl');
    await queryInterface.removeColumn('sales', 'carrier');
    await queryInterface.removeColumn('sales', 'shippedAt');
    await queryInterface.removeColumn('sales', 'errorMessage');
    await queryInterface.removeColumn('sales', 'syncStatus');
    await queryInterface.removeColumn('sales', 'completedAt');
    
    console.log('✅ Campos de tracking eliminados');
  }
};
