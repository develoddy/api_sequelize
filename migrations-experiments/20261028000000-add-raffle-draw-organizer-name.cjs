'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn(
            'raffle_draws',
            'organizer_name',
            {
                type: Sequelize.STRING(150),
                allowNull: true,
            }
        );
    },

    async down(queryInterface) {
        await queryInterface.removeColumn(
            'raffle_draws',
            'organizer_name'
        );
    },
};
