import { DataTypes } from 'sequelize';
import { sequelize } from '../database/database.js';
import { User } from './User.js';
import { Guest } from './Guest.js';
import { Sale } from './Sale.js';

export const Receipt = sequelize.define('receipts', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },

    // Relación opcional con usuario registrado
    userId: { 
        type: DataTypes.INTEGER, 
        allowNull: true,
        references: { model: User, key: 'id' }
    },

    // Relación opcional con invitado
    guestId: { 
        type: DataTypes.INTEGER, 
        allowNull: true,
        references: { model: Guest, key: 'id' }
    },

    // Relación opcional con venta (simulación)
    saleId: { 
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: Sale, key: 'id' }
    },

    amount: { type: DataTypes.FLOAT, allowNull: false },
    paymentMethod: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'efectivo' },
    paymentDate: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'pendiente' },
    notes: { type: DataTypes.STRING(250), allowNull: true },
    zipcode: { type: DataTypes.STRING(250), allowNull: false },
}, {
    timestamps: true,
    tableName: 'receipts'
});

// 🔹 Relaciones inversas (para eager loading)
User.hasMany(Receipt, { foreignKey: 'userId' });
Guest.hasMany(Receipt, { foreignKey: 'guestId' });
Sale.hasMany(Receipt, { foreignKey: 'saleId' });
Receipt.belongsTo(User, { foreignKey: 'userId' });
Receipt.belongsTo(Guest, { foreignKey: 'guestId' });
Receipt.belongsTo(Sale, { foreignKey: 'saleId' });

//uando seas autónomo y emitas facturas, solo necesitas agregar:
//Receipt.belongsTo(Invoice, { foreignKey: 'invoiceId' });
//Invoice.hasMany(Receipt, { foreignKey: 'invoiceId' });

export default Receipt;
