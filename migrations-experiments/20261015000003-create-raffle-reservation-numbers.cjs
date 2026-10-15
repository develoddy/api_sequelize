'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('raffle_reservation_numbers', {
            reservation_id: {
                type: Sequelize.INTEGER.UNSIGNED,
                allowNull: false,
                primaryKey: true,
                references: {
                    model: 'raffle_reservations',
                    key: 'id',
                },
                onUpdate: 'CASCADE',
                onDelete: 'RESTRICT',
            },
            number_id: {
                type: Sequelize.INTEGER.UNSIGNED,
                allowNull: false,
                primaryKey: true,
                references: {
                    model: 'raffle_numbers',
                    key: 'id',
                },
                onUpdate: 'CASCADE',
                onDelete: 'RESTRICT',
            },
        });

        await queryInterface.addIndex(
            'raffle_reservation_numbers',
            ['number_id'],
            {
                name: 'idx_raffle_reservation_numbers_number',
            }
        );
    },

    async down(queryInterface) {
        await queryInterface.dropTable('raffle_reservation_numbers');
    },
};
