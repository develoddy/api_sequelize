'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('newsletter_subscribers', 'userId', {
      type: Sequelize.STRING(255),
      allowNull: true,
      comment: 'ID del usuario autenticado (NULL para guests)',
      after: 'email'
    });

    // Crear índice para búsquedas rápidas por userId
    await queryInterface.addIndex('newsletter_subscribers', ['userId'], {
      name: 'idx_newsletter_userId'
    });

    // Crear índice compuesto para búsquedas combinadas
    await queryInterface.addIndex('newsletter_subscribers', ['userId', 'email', 'status'], {
      name: 'idx_newsletter_userId_email_status'
    });
  },

  async down(queryInterface, Sequelize) {
    // Eliminar índices
    await queryInterface.removeIndex('newsletter_subscribers', 'idx_newsletter_userId_email_status');
    await queryInterface.removeIndex('newsletter_subscribers', 'idx_newsletter_userId');
    
    // Eliminar columna
    await queryInterface.removeColumn('newsletter_subscribers', 'userId');
  }
};
