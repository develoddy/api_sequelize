'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('prelaunch_config', 'launch_date', {
      type: Sequelize.DATE,
      allowNull: true,
      after: 'enabled',
      comment: 'Fecha y hora programada para el lanzamiento oficial'
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('prelaunch_config', 'launch_date');
  }
};
