'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Agregar columna preferences
    await queryInterface.addColumn('newsletter_subscribers', 'preferences', {
      type: Sequelize.JSON,
      allowNull: true,
      defaultValue: null,
      comment: 'Preferencias de contenido y canales del suscriptor: {content: ["novedades", "promociones", "prelaunch"], channels: ["email", "sms", "whatsapp"]}'
    });

    console.log('✅ Campo preferences agregado a newsletter_subscribers');
  },

  async down (queryInterface, Sequelize) {
    // Eliminar columna preferences
    await queryInterface.removeColumn('newsletter_subscribers', 'preferences');
    
    console.log('❌ Campo preferences eliminado de newsletter_subscribers');
  }
};
