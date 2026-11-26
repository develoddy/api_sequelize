'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('newsletter_subscribers', 'source', {
      type: Sequelize.ENUM(
        'home',
        'footer',
        'checkout',
        'campaign_import',
        'admin',
        'editorial',
        'product'
      ),
      allowNull: true,
      defaultValue: 'home'
    });
  },

  async down(queryInterface, Sequelize) {
    const [rows] = await queryInterface.sequelize.query(
      "SELECT COUNT(*) AS total FROM newsletter_subscribers WHERE source IN ('editorial', 'product')"
    );

    if (Number(rows[0].total) > 0) {
      throw new Error(
        'Rollback blocked: subscribers with new sources exist'
      );
    }

    await queryInterface.changeColumn('newsletter_subscribers', 'source', {
      type: Sequelize.ENUM(
        'home',
        'footer',
        'checkout',
        'campaign_import',
        'admin'
      ),
      allowNull: true,
      defaultValue: 'home'
    });
  }
};
