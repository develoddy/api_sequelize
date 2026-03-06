import { DataTypes } from "sequelize";
import { sequelize } from "../database/database.js";

export const Liability = sequelize.define('liabilities', {
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
        comment: 'Nombre del pasivo (ej: Hipoteca Vivienda, Tarjeta Visa)'
    },
    type: {
        type: DataTypes.ENUM('credit_card', 'loan', 'mortgage', 'debt', 'other'),
        defaultValue: 'debt',
        allowNull: false,
        comment: 'Tipo de pasivo'
    },
    total_amount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        comment: 'Monto original de la deuda'
    },
    remaining_amount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        comment: 'Saldo actual pendiente'
    },
    monthly_payment: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        comment: 'Pago mensual'
    },
    interest_rate: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
        comment: 'Tasa de interés anual en porcentaje'
    },
    start_date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        comment: 'Fecha de inicio de la deuda'
    },
    due_date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        comment: 'Fecha de vencimiento final'
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Notas adicionales'
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: 'Indica si el pasivo está activo'
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
    tableName: 'liabilities',
    indexes: [
        {
            name: 'idx_user_type',
            fields: ['user_id', 'type']
        },
        {
            name: 'idx_user_active',
            fields: ['user_id', 'is_active']
        },
        {
            name: 'idx_user_remaining',
            fields: ['user_id', 'remaining_amount']
        }
    ]
});
