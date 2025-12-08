import { DataTypes } from 'sequelize';
import { sequelize } from '../database/database.js';

export const PrelaunchConfig = sequelize.define('PrelaunchConfig', {
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
        defaultValue: DataTypes.NOW,
        allowNull: false
    }
}, {
    tableName: 'prelaunch_config',
    timestamps: false,
    indexes: [
        {
            unique: true,
            fields: ['id']
        }
    ]
});

// Método estático para obtener/crear la configuración
PrelaunchConfig.getInstance = async function() {
    let config = await PrelaunchConfig.findByPk(1);
    
    if (!config) {
        // Crear configuración inicial si no existe
        config = await PrelaunchConfig.create({
            id: 1,
            enabled: false // Por defecto deshabilitado
        });
    }
    
    return config;
};

// Método estático para actualizar la configuración
PrelaunchConfig.updateConfig = async function(enabled, updatedBy = null) {
    const config = await PrelaunchConfig.getInstance();
    
    return await config.update({
        enabled: enabled,
        updated_by: updatedBy,
        updated_at: new Date()
    });
};

// Método estático para obtener solo el estado actual
PrelaunchConfig.isEnabled = async function() {
    const config = await PrelaunchConfig.getInstance();
    return config.enabled;
};