'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn(
            'raffle_draws',
            'results_published_at',
            {
                type: Sequelize.DATE,
                allowNull: true,
                defaultValue: null,
            }
        );
    },

    async down(queryInterface) {
        await queryInterface.removeColumn(
            'raffle_draws',
            'results_published_at'
        );
    },
};
