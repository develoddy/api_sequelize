'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('sale_details', 'type_campaign', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: null,
      comment: '1=Campaign Discount, 2=Flash Sale, 3=Cupón'
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('sale_details', 'type_campaign');
  }
};
