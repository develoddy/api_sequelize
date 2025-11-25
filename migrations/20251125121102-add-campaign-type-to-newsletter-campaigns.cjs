'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Agregar columna campaign_type
    await queryInterface.addColumn('newsletter_campaigns', 'campaign_type', {
      type: Sequelize.ENUM('novedades', 'promociones', 'prelaunch', 'general'),
      allowNull: false,
      defaultValue: 'general',
      comment: 'Tipo de campaña para filtrar por preferencias de usuarios'
    });

    // Agregar índice para mejorar búsquedas por tipo
    await queryInterface.addIndex('newsletter_campaigns', ['campaign_type'], {
      name: 'idx_newsletter_campaign_type'
    });

    console.log('✅ Campo campaign_type agregado a newsletter_campaigns');
  },

  async down (queryInterface, Sequelize) {
    // Eliminar índice
    await queryInterface.removeIndex('newsletter_campaigns', 'idx_newsletter_campaign_type');
    
    // Eliminar columna
    await queryInterface.removeColumn('newsletter_campaigns', 'campaign_type');
    
    // Eliminar ENUM type (solo necesario en PostgreSQL, en MySQL se elimina automáticamente)
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_newsletter_campaigns_campaign_type";');
    
    console.log('❌ Campo campaign_type eliminado de newsletter_campaigns');
  }
};
