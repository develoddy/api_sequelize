'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('raffle_numbers', {
            id: {
                type: Sequelize.INTEGER.UNSIGNED,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false,
            },
            draw_id: {
                type: Sequelize.INTEGER.UNSIGNED,
                allowNull: false,
                references: {
                    model: 'raffle_draws',
                    key: 'id',
                },
                onUpdate: 'CASCADE',
                onDelete: 'RESTRICT',
            },
            value: {
                type: Sequelize.INTEGER.UNSIGNED,
                allowNull: false,
            },
            status: {
                type: Sequelize.ENUM(
                    'available',
                    'pending',
                    'confirmed'
                ),
                allowNull: false,
                defaultValue: 'available',
            },
        });

        await queryInterface.addIndex(
            'raffle_numbers',
            ['draw_id', 'value'],
            {
                unique: true,
                name: 'uq_raffle_numbers_draw_value',
            }
        );
    },

    async down(queryInterface) {
        await queryInterface.dropTable('raffle_numbers');
    },
};
