'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('sliders', 'placement', {
      type: Sequelize.STRING(30),
      allowNull: false,
      defaultValue: 'home',
      comment: 'Banner placement: home or editorial'
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('sliders', 'placement');
  }
};
