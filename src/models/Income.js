import { DataTypes } from "sequelize";
import { sequelize } from "../database/database.js";

export const Income = sequelize.define('incomes', {
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
    bank_account_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'bank_accounts',
            key: 'id'
        },
        comment: 'Cuenta bancaria asociada'
    },
    category: {
        type: DataTypes.ENUM('salary', 'freelance', 'investments', 'rental', 'business', 'gifts', 'internal_transfer', 'other'),
        defaultValue: 'other',
        allowNull: false,
        comment: 'Categoría del ingreso'
    },
    amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        comment: 'Monto del ingreso'
    },
    currency: {
        type: DataTypes.STRING(3),
        defaultValue: 'EUR',
        allowNull: false
    },
    description: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'Descripción del ingreso'
    },
    date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        comment: 'Fecha del ingreso'
    },
    is_recurring: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'Indica si es un ingreso recurrente'
    },
    recurrence_type: {
        type: DataTypes.ENUM('daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly', 'none'),
        defaultValue: 'none',
        comment: 'Tipo de recurrencia'
    },
    tags: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'Tags separados por comas para filtrado'
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    source_account_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'bank_accounts',
            key: 'id'
        },
        comment: 'Cuenta origen en transferencias internas'
    },
    linked_transaction_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'ID del expense vinculado en transferencias internas'
    }
}, {
    timestamps: true,
    tableName: 'incomes',
    indexes: [
        { fields: ['user_id'] },
        { fields: ['date'] },
        { fields: ['category'] },
        { fields: ['bank_account_id'] },
        { fields: ['user_id', 'date'] }
    ]
});
