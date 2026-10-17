'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn(
            'raffle_reservations',
            'source',
            {
                type: Sequelize.ENUM('public', 'manual'),
                allowNull: false,
                defaultValue: 'public',
            }
        );

        await queryInterface.changeColumn(
            'raffle_reservations',
            'expires_at',
            {
                type: Sequelize.DATE,
                allowNull: true,
            }
        );
    },

    async down(queryInterface, Sequelize) {
        const [rows] = await queryInterface.sequelize.query(
            'SELECT COUNT(*) AS total FROM raffle_reservations WHERE expires_at IS NULL'
        );

        if (Number(rows[0].total) > 0) {
            throw new Error(
                'No se puede revertir: existen reservas sin caducidad.'
            );
        }

        await queryInterface.changeColumn(
            'raffle_reservations',
            'expires_at',
            {
                type: Sequelize.DATE,
                allowNull: false,
            }
        );

        await queryInterface.removeColumn(
            'raffle_reservations',
            'source'
        );
    },
};
