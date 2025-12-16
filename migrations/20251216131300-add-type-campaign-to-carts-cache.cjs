'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('cartsCache', 'type_campaign', {
      type: Sequelize.INTEGER,
      allowNull: true,
      after: 'code_discount',
      comment: '1=Campaign Discount, 2=Flash Sale, 3=Cupón'
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('cartsCache', 'type_campaign');
  }
};
