'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn(
            'raffle_draws',
            'banner_image_mobile',
            {
                type: Sequelize.STRING(500),
                allowNull: true,
            }
        );
    },

    async down(queryInterface) {
        await queryInterface.removeColumn(
            'raffle_draws',
            'banner_image_mobile'
        );
    },
};
