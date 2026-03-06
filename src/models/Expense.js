import { DataTypes } from "sequelize";
import { sequelize } from "../database/database.js";

export const Expense = sequelize.define('expenses', {
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
        comment: 'Cuenta bancaria desde donde se realizó el gasto'
    },
    category: {
        type: DataTypes.ENUM(
            'housing', 'utilities', 'groceries', 'transport', 'health', 
            'insurance', 'entertainment', 'education', 'clothing', 
            'savings', 'investments', 'debt_payment', 'restaurants', 
            'travel', 'gifts', 'personal_care', 'technology', 'internal_transfer', 'other'
        ),
        defaultValue: 'other',
        allowNull: false,
        comment: 'Categoría del gasto'
    },
    amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        comment: 'Monto del gasto'
    },
    currency: {
        type: DataTypes.STRING(3),
        defaultValue: 'EUR',
        allowNull: false
    },
    description: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'Descripción del gasto'
    },
    date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        comment: 'Fecha del gasto'
    },
    is_recurring: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'Indica si es un gasto recurrente'
    },
    recurrence_type: {
        type: DataTypes.ENUM('daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly', 'none'),
        defaultValue: 'none',
        comment: 'Tipo de recurrencia'
    },
    is_essential: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'Indica si es un gasto esencial (necesidad vs lujo)'
    },
    payment_method: {
        type: DataTypes.ENUM('cash', 'debit_card', 'credit_card', 'bank_transfer', 'other'),
        defaultValue: 'other',
        comment: 'Método de pago utilizado'
    },
    tags: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'Tags separados por comas para filtrado'
    },
    receipt_url: {
        type: DataTypes.STRING(500),
        allowNull: true,
        comment: 'URL del recibo/factura digitalizada'
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    target_account_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'bank_accounts',
            key: 'id'
        },
        comment: 'Cuenta destino en transferencias internas'
    },
    linked_transaction_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'ID del income vinculado en transferencias internas'
    }
}, {
    timestamps: true,
    tableName: 'expenses',
    indexes: [
        { fields: ['user_id'] },
        { fields: ['date'] },
        { fields: ['category'] },
        { fields: ['bank_account_id'] },
        { fields: ['is_essential'] },
        { fields: ['user_id', 'date'] }
    ]
});
