'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn(
            'raffle_draws',
            'whatsapp_number',
            {
                type: Sequelize.STRING(20),
                allowNull: true,
            }
        );
    },

    async down(queryInterface) {
        await queryInterface.removeColumn(
            'raffle_draws',
            'whatsapp_number'
        );
    },
};
