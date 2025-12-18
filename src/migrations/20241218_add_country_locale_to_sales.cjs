const { DataTypes } = require('sequelize');

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('sales', 'country', {
      type: DataTypes.STRING(5),
      allowNull: true,
      defaultValue: 'es',
      comment: 'País de contexto de la compra (es, fr, it, de)'
    });

    await queryInterface.addColumn('sales', 'locale', {
      type: DataTypes.STRING(5),
      allowNull: true,
      defaultValue: 'es',
      comment: 'Idioma de contexto de la compra (es, fr, it, de)'
    });

    console.log('✅ Added country and locale columns to sales table');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('sales', 'country');
    await queryInterface.removeColumn('sales', 'locale');
    
    console.log('✅ Removed country and locale columns from sales table');
  }
};