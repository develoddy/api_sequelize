'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('raffle_draws', {
            id: {
                type: Sequelize.INTEGER.UNSIGNED,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false,
            },
            name: {
                type: Sequelize.STRING(150),
                allowNull: false,
            },
            total_numbers: {
                type: Sequelize.INTEGER.UNSIGNED,
                allowNull: false,
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
            },
            updated_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal(
                    'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'
                ),
            },
        });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('raffle_draws');
    },
};
