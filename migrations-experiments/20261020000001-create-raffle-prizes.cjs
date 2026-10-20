'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('raffle_prizes', {
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
            position: {
                type: Sequelize.INTEGER.UNSIGNED,
                allowNull: false,
            },
            title: {
                type: Sequelize.STRING(200),
                allowNull: false,
            },
            description: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            image_path: {
                type: Sequelize.STRING(500),
                allowNull: true,
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

        await queryInterface.addIndex('raffle_prizes', ['draw_id', 'position'], {
            unique: true,
            name: 'raffle_prizes_draw_position_unique',
        });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('raffle_prizes');
    },
};
