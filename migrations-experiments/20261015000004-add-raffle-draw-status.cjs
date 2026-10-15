'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn('raffle_draws', 'status', {
            type: Sequelize.ENUM(
                'draft',
                'published',
                'closed'
            ),
            allowNull: false,
            defaultValue: 'draft',
        });
    },

    async down(queryInterface) {
        await queryInterface.removeColumn(
            'raffle_draws',
            'status'
        );
    },
};
