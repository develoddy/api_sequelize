'use strict';

/**
 * Migration: Add tenant_id to Sales table
 * 
 * Añade soporte multi-tenant al sistema de ventas/pedidos de Printful
 * Permite asociar cada venta a un tenant específico (cliente externo)
 * 
 * @author Claude (GitHub Copilot)
 * @date 2026-03-11
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('🏢 Agregando campo tenant_id a Sales...');
    
    const tableInfo = await queryInterface.describeTable('sales');
    
    // Solo agregar si no existe el campo
    if (!tableInfo.tenant_id) {
      // Paso 1: Agregar columna tenant_id como nullable (para ventas existentes)
      await queryInterface.addColumn('sales', 'tenant_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'ID del tenant (cliente SaaS) - NULL para la tienda principal'
      });
      console.log('   ✅ tenant_id agregado (nullable)');

      // Paso 2: Crear índice para mejorar performance de queries filtradas por tenant
      await queryInterface.addIndex('sales', ['tenant_id'], {
        name: 'idx_sales_tenant_id'
      });
      console.log('   ✅ Índice creado en tenant_id');

      // Paso 3: Añadir foreign key a tenants
      await queryInterface.addConstraint('sales', {
        fields: ['tenant_id'],
        type: 'foreign key',
        name: 'fk_sales_tenant_id',
        references: {
          table: 'tenants',
          field: 'id'
        },
        onDelete: 'SET NULL', // Si se elimina un tenant, las ventas quedan huérfanas pero no se pierden
        onUpdate: 'CASCADE'
      });
      console.log('   ✅ Foreign key agregada a tenants table');

      console.log('✅ Migración completada: tenant_id agregado a Sales');
      console.log('ℹ️  Ventas existentes tendrán tenant_id = NULL (tienda principal)');
      console.log('ℹ️  Nuevas ventas de clientes externos deberán especificar tenant_id');
      
    } else {
      console.log('   ⏭️  tenant_id ya existe, saltando...');
    }
  },

  async down(queryInterface, Sequelize) {
    console.log('🔄 Revirtiendo migración: Eliminando tenant_id de Sales...');
    
    const tableInfo = await queryInterface.describeTable('sales');
    
    if (tableInfo.tenant_id) {
      // Eliminar foreign key primero
      await queryInterface.removeConstraint('sales', 'fk_sales_tenant_id');
      console.log('   ✅ Foreign key eliminada');

      // Eliminar índice
      await queryInterface.removeIndex('sales', 'idx_sales_tenant_id');
      console.log('   ✅ Índice eliminado');

      // Eliminar columna
      await queryInterface.removeColumn('sales', 'tenant_id');
      console.log('   ✅ tenant_id eliminado');
      
      console.log('✅ Rollback completado');
    } else {
      console.log('   ⏭️  tenant_id no existe, nada que revertir');
    }
  }
};
