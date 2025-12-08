const { DataTypes } = require('sequelize');

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('prelaunch_config', {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            enabled: {
                type: DataTypes.BOOLEAN,
                defaultValue: false,
                allowNull: false,
                comment: 'Si está habilitado el modo pre-lanzamiento'
            },
            updated_by: {
                type: DataTypes.INTEGER,
                allowNull: true,
                comment: 'ID del admin que hizo el último cambio'
            },
            updated_at: {
                type: DataTypes.DATE,
                defaultValue: Sequelize.NOW,
                allowNull: false
            }
        });

        // Insertar registro inicial
        await queryInterface.bulkInsert('prelaunch_config', [{
            id: 1,
            enabled: false,
            updated_at: new Date()
        }]);

        // Crear índice único
        await queryInterface.addIndex('prelaunch_config', ['id'], {
            unique: true,
            name: 'prelaunch_config_id_unique'
        });
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.dropTable('prelaunch_config');
    }
};