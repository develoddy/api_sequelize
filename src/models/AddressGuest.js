import { DataTypes } from 'sequelize';
import { sequelize } from '../database/database.js';

export const AddressGuest = sequelize.define('address_guests', {
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
    tableName: 'address_guests'
});
