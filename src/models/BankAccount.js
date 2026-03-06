import { DataTypes } from "sequelize";
import { sequelize } from "../database/database.js";

export const BankAccount = sequelize.define('bank_accounts', {
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
        type: DataTypes.STRING(100),
        allowNull: false,
        comment: 'Nombre de la cuenta (ej: Cuenta corriente, Ahorros)'
    },
    bank_name: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: 'Nombre del banco'
    },
    account_type: {
        type: DataTypes.ENUM('checking', 'savings', 'credit', 'investment', 'other'),
        defaultValue: 'checking',
        comment: 'Tipo de cuenta'
    },
    balance: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0.00,
        allowNull: false,
        comment: 'Balance actual de la cuenta'
    },
    currency: {
        type: DataTypes.STRING(3),
        defaultValue: 'EUR',
        allowNull: false,
        comment: 'Código de moneda ISO 4217'
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: 'Indica si la cuenta está activa'
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Notas adicionales sobre la cuenta'
    }
}, {
    timestamps: true,
    tableName: 'bank_accounts',
    indexes: [
        { fields: ['user_id'] },
        { fields: ['is_active'] }
    ]
});
