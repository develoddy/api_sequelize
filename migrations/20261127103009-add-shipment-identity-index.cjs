'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.addIndex(
      'shipments',
      ['saleId', 'printfulShipmentId'],
      {
        name: 'uq_shipments_sale_printful',
        unique: true
      }
    );
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
      'shipments',
      'uq_shipments_sale_printful'
    );
  }
};
