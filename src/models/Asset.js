import { DataTypes } from "sequelize";
import { sequelize } from "../database/database.js";

export const Asset = sequelize.define('assets', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    name: {
        type: DataTypes.STRING(255),
        allowNull: false,
        comment: 'Nombre del activo (ej: Apartamento Madrid, Tesla Model 3)'
    },
    type: {
        type: DataTypes.ENUM('cash', 'property', 'investment', 'vehicle', 'other'),
        defaultValue: 'other',
        allowNull: false,
        comment: 'Tipo de activo'
    },
    current_value: {
        type: DataTypes.DECIMAL(12, 2),
        defaultValue: 0.00,
        allowNull: false,
        comment: 'Valor actual del activo'
    },
    bank_account_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'bank_accounts',
            key: 'id'
        },
        comment: 'Vincula con bank_accounts para activos tipo cash'
    },
    purchase_date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        comment: 'Fecha de adquisición del activo'
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Notas adicionales'
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: 'Indica si el activo está activo'
    },
    last_updated: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        allowNull: false
    }
}, {
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'last_updated',
    tableName: 'assets',
    indexes: [
        {
            name: 'idx_user_type',
            fields: ['user_id', 'type']
        },
        {
            name: 'idx_user_active',
            fields: ['user_id', 'is_active']
        }
    ]
});
