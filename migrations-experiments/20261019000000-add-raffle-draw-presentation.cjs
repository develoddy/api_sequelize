'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn('raffle_draws', 'headline', {
            type: Sequelize.STRING(200),
            allowNull: true,
        });

        await queryInterface.addColumn('raffle_draws', 'description', {
            type: Sequelize.TEXT,
            allowNull: true,
        });

        await queryInterface.addColumn('raffle_draws', 'banner_image', {
            type: Sequelize.STRING(500),
            allowNull: true,
        });

        await queryInterface.addColumn('raffle_draws', 'ticket_price', {
            type: Sequelize.DECIMAL(10, 2),
            allowNull: true,
        });

        await queryInterface.addColumn('raffle_draws', 'draw_date', {
            type: Sequelize.DATE,
            allowNull: true,
        });
    },

    async down(queryInterface) {
        await queryInterface.removeColumn('raffle_draws', 'draw_date');
        await queryInterface.removeColumn('raffle_draws', 'ticket_price');
        await queryInterface.removeColumn('raffle_draws', 'banner_image');
        await queryInterface.removeColumn('raffle_draws', 'description');
        await queryInterface.removeColumn('raffle_draws', 'headline');
    },
};
