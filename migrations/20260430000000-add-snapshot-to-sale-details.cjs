'use strict';

/**
 * Migration: Add Product Snapshot Fields to SaleDetails
 * 
 * Convierte sale_details en un snapshot inmutable del producto comprado.
 * Esto permite que emails y tracking pages funcionen sin depender de la tabla products.
 * 
 * ARQUITECTURA INBOX ZERO:
 * - sale_details = source of truth para customer-facing UI
 * - productId/variedadId = solo para analytics (opcional)
 * - Emails/tracking NUNCA consultan products (solo snapshots)
 * 
 * @author Claude (GitHub Copilot)
 * @date 2026-04-30
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('🎯 Agregando campos de snapshot inmutable a SaleDetails...');
    
    const tableInfo = await queryInterface.describeTable('sale_details');
    
    // 1️⃣ product_name: Nombre del producto en momento de compra
    if (!tableInfo.product_name) {
      await queryInterface.addColumn('sale_details', 'product_name', {
        type: Sequelize.STRING(255),
        allowNull: true, // nullable inicialmente - se hará NOT NULL después de backfill
        comment: 'Nombre del producto en momento de compra (INMUTABLE - source of truth para emails)'
      });
      console.log('   ✅ product_name agregado');
    } else {
      console.log('   ⏭️  product_name ya existe, saltando...');
    }

    // 2️⃣ product_image: URL de imagen del producto (snapshot)
    if (!tableInfo.product_image) {
      await queryInterface.addColumn('sale_details', 'product_image', {
        type: Sequelize.STRING(500),
        allowNull: true, // nullable inicialmente - se hará NOT NULL después de backfill
        comment: 'URL de imagen del producto en momento de compra (INMUTABLE - source of truth para emails)'
      });
      console.log('   ✅ product_image agregado');
    } else {
      console.log('   ⏭️  product_image ya existe, saltando...');
    }

    // 3️⃣ variant_name: Variante del producto (size/color/etc)
    if (!tableInfo.variant_name) {
      await queryInterface.addColumn('sale_details', 'variant_name', {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Variante del producto (size/color/etc) en momento de compra'
      });
      console.log('   ✅ variant_name agregado');
    } else {
      console.log('   ⏭️  variant_name ya existe, saltando...');
    }

    // 4️⃣ product_sku: SKU del producto
    if (!tableInfo.product_sku) {
      await queryInterface.addColumn('sale_details', 'product_sku', {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'SKU del producto en momento de compra'
      });
      console.log('   ✅ product_sku agregado');
    } else {
      console.log('   ⏭️  product_sku ya existe, saltando...');
    }

    // 5️⃣ Crear índice en product_name para mejorar queries de búsqueda
    try {
      await queryInterface.addIndex('sale_details', ['product_name'], {
        name: 'idx_sale_details_product_name'
      });
      console.log('   ✅ Índice creado en product_name');
    } catch (error) {
      if (error.original && error.original.code === 'ER_DUP_KEYNAME') {
        console.log('   ⏭️  Índice idx_sale_details_product_name ya existe, saltando...');
      } else {
        throw error;
      }
    }

    console.log('\n✅ Migración completada: Snapshots agregados a SaleDetails');
    console.log('\n⚠️  PRÓXIMOS PASOS REQUERIDOS:');
    console.log('   1. Ejecutar backfill: node scripts/backfill-sale-details-snapshots.js --dry-run');
    console.log('   2. Validar resultados y ejecutar: node scripts/backfill-sale-details-snapshots.js');
    console.log('   3. Verificar que todos los registros tienen snapshots poblados');
    console.log('   4. (Opcional) Hacer campos NOT NULL en migración futura\n');
    console.log('📚 Ver documentación: api/INBOX-ZERO-ARCHITECTURE-RULES.md\n');
  },

  async down(queryInterface, Sequelize) {
    console.log('🔄 Revirtiendo migración: Eliminando campos de snapshot de SaleDetails...');
    
    const tableInfo = await queryInterface.describeTable('sale_details');
    
    // Eliminar índice primero
    try {
      await queryInterface.removeIndex('sale_details', 'idx_sale_details_product_name');
      console.log('   ✅ Índice eliminado');
    } catch (error) {
      console.log('   ⏭️  Índice no existe, saltando...');
    }

    // Eliminar columnas en orden inverso
    if (tableInfo.product_sku) {
      await queryInterface.removeColumn('sale_details', 'product_sku');
      console.log('   ✅ product_sku eliminado');
    }

    if (tableInfo.variant_name) {
      await queryInterface.removeColumn('sale_details', 'variant_name');
      console.log('   ✅ variant_name eliminado');
    }

    if (tableInfo.product_image) {
      await queryInterface.removeColumn('sale_details', 'product_image');
      console.log('   ✅ product_image eliminado');
    }

    if (tableInfo.product_name) {
      await queryInterface.removeColumn('sale_details', 'product_name');
      console.log('   ✅ product_name eliminado');
    }

    console.log('✅ Rollback completado: SaleDetails restaurado a estado previo');
  }
};
