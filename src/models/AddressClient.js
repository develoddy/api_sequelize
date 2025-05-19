import { DataTypes } from 'sequelize';
import { sequelize } from '../database/database.js';
import { User } from './User.js';

export const AddressClient = sequelize.define('address_clients', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING(250), allowNull: false },
    surname: { type: DataTypes.STRING(250), allowNull: false },
    pais: { type: DataTypes.STRING(250), allowNull: false },
    address: { type: DataTypes.STRING(250), allowNull: false },
    zipcode: { type: DataTypes.STRING(250), allowNull: false },
    poblacion: { type: DataTypes.STRING(250), allowNull: false },
    ciudad: { type: DataTypes.STRING(250), allowNull: false },
    email: { type: DataTypes.STRING(250), allowNull: false },
    phone: { type: DataTypes.STRING(250), allowNull: false },
    referencia: { type: DataTypes.STRING(250), allowNull: true },
    nota: { type: DataTypes.STRING, allowNull: true },
    birthday: { type: DataTypes.STRING(20), allowNull: true },
    usual_shipping_address: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false,},
}, {
    timestamps: true,
    tableName: 'address_clients'
});

// Define la asociación con el modelo de Usuario
AddressClient.belongsTo(User, { foreignKey: 'userId' });
