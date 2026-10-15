'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('raffle_reservations', {
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
            participant_name: {
                type: Sequelize.STRING(150),
                allowNull: false,
            },
            status: {
                type: Sequelize.ENUM(
                    'active',
                    'confirmed',
                    'cancelled',
                    'expired'
                ),
                allowNull: false,
                defaultValue: 'active',
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
            },
            expires_at: {
                type: Sequelize.DATE,
                allowNull: false,
            },
        });

        await queryInterface.addIndex(
            'raffle_reservations',
            ['draw_id', 'status', 'expires_at'],
            {
                name: 'idx_raffle_reservations_draw_status_expiry',
            }
        );
    },

    async down(queryInterface) {
        await queryInterface.dropTable('raffle_reservations');
    },
};
