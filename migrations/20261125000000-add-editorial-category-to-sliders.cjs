'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('sliders', 'editorial_category', {
      type: Sequelize.STRING(30),
      allowNull: true,
      defaultValue: null,
      comment: 'Editorial campaign category'
    });

    await queryInterface.bulkUpdate(
      'sliders',
      { editorial_category: 'default' },
      { placement: 'editorial' }
    );
  },

  async down(queryInterface) {
    await queryInterface.removeColumn(
      'sliders',
      'editorial_category'
    );
  }
};
