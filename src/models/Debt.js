import { DataTypes } from "sequelize";
import { sequelize } from "../database/database.js";

export const Debt = sequelize.define('debts', {
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
        comment: 'Cuenta bancaria desde la que se paga esta deuda'
    },
    creditor: {
        type: DataTypes.STRING(150),
        allowNull: false,
        comment: 'Nombre del acreedor (banco, persona, empresa)'
    },
    debt_type: {
        type: DataTypes.ENUM('mortgage', 'car_loan', 'personal_loan', 'student_loan', 'credit_card', 'business_loan', 'other'),
        defaultValue: 'other',
        allowNull: false,
        comment: 'Tipo de deuda'
    },
    original_amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        comment: 'Monto original de la deuda'
    },
    remaining_balance: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        comment: 'Balance pendiente actual'
    },
    currency: {
        type: DataTypes.STRING(3),
        defaultValue: 'EUR',
        allowNull: false
    },
    interest_rate: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
        comment: 'Tasa de interés anual (%)'
    },
    monthly_payment: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        comment: 'Pago mensual esperado'
    },
    start_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        comment: 'Fecha de inicio de la deuda'
    },
    due_date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        comment: 'Fecha estimada de finalización'
    },
    payment_day: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Día del mes para el pago (1-31)'
    },
    status: {
        type: DataTypes.ENUM('active', 'paid_off', 'defaulted', 'refinanced'),
        defaultValue: 'active',
        comment: 'Estado de la deuda'
    },
    priority: {
        type: DataTypes.ENUM('low', 'medium', 'high', 'critical'),
        defaultValue: 'medium',
        comment: 'Prioridad de pago'
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    timestamps: true,
    tableName: 'debts',
    indexes: [
        { fields: ['user_id'] },
        { fields: ['status'] },
        { fields: ['debt_type'] },
        { fields: ['priority'] },
        { fields: ['due_date'] }
    ]
});
