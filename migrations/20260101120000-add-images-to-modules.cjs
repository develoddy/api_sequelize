'use strict';

/**
 * Migration: Add images/screenshots to modules
 * 
 * Agrega campos para almacenar:
 * - tagline: Frase corta de gancho
 * - screenshots: Array de URLs de imágenes
 * - download_url: URL del archivo descargable (ZIP, etc.)
 * - post_purchase_email: Template del email post-compra
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    // Verificar si cada columna existe antes de agregarla
    const tableDescription = await queryInterface.describeTable('modules');
    
    // Agregar tagline si no existe
    if (!tableDescription.tagline) {
      await queryInterface.addColumn('modules', 'tagline', {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Frase corta de gancho para marketing'
      });
    }

    // Agregar detailed_description si no existe
    if (!tableDescription.detailed_description) {
      await queryInterface.addColumn('modules', 'detailed_description', {
        type: Sequelize.TEXT('long'),
        allowNull: true,
        comment: 'Descripción larga para la landing page (soporta HTML/Markdown)'
      });
    }

    // Agregar screenshots si no existe
    if (!tableDescription.screenshots) {
      await queryInterface.addColumn('modules', 'screenshots', {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Array de URLs de screenshots/imágenes del producto'
      });
    }

    // Agregar download_url si no existe
    if (!tableDescription.download_url) {
      await queryInterface.addColumn('modules', 'download_url', {
        type: Sequelize.STRING(500),
        allowNull: true,
        comment: 'URL del archivo descargable (ZIP con código, docs, etc.)'
      });
    }

    // Agregar post_purchase_email si no existe
    if (!tableDescription.post_purchase_email) {
      await queryInterface.addColumn('modules', 'post_purchase_email', {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Template HTML del email que se envía post-compra'
      });
    }

    // Agregar features si no existe
    if (!tableDescription.features) {
      await queryInterface.addColumn('modules', 'features', {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Lista de features/beneficios del producto'
      });
    }

    // Agregar tech_stack si no existe
    if (!tableDescription.tech_stack) {
      await queryInterface.addColumn('modules', 'tech_stack', {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Tecnologías usadas (Node.js, Angular, etc.)'
      });
    }

    // Agregar requirements si no existe
    if (!tableDescription.requirements) {
      await queryInterface.addColumn('modules', 'requirements', {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Requerimientos técnicos para instalar/usar'
      });
    }

    console.log('✅ Campos de imágenes y contenido agregados a modules');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('modules', 'tagline');
    await queryInterface.removeColumn('modules', 'screenshots');
    await queryInterface.removeColumn('modules', 'download_url');
    await queryInterface.removeColumn('modules', 'post_purchase_email');
    await queryInterface.removeColumn('modules', 'detailed_description');
    await queryInterface.removeColumn('modules', 'features');
    await queryInterface.removeColumn('modules', 'tech_stack');
    await queryInterface.removeColumn('modules', 'requirements');
    
    console.log('✅ Campos de imágenes y contenido eliminados de modules');
  }
};
