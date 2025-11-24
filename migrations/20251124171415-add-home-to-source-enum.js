'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Modificar la columna 'source' para agregar 'home' al ENUM
    await queryInterface.changeColumn('prelaunch_subscribers', 'source', {
      type: Sequelize.ENUM('main_form', 'cta_final', 'home'),
      defaultValue: 'main_form',
      allowNull: true,
      comment: 'Indica de qué formulario proviene la suscripción'
    });
  },

  async down (queryInterface, Sequelize) {
    // Revertir la columna 'source' a su estado original (sin 'home')
    await queryInterface.changeColumn('prelaunch_subscribers', 'source', {
      type: Sequelize.ENUM('main_form', 'cta_final'),
      defaultValue: 'main_form',
      allowNull: true,
      comment: 'Indica de qué formulario proviene la suscripción'
    });
  }
};
