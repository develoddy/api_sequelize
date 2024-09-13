import { DataTypes } from 'sequelize';
import { sequelize } from '../database/database.js';
import { User } from './User.js';
import { Product } from './Product.js';
import { Variedad } from './Variedad.js';

export const Wishlist = sequelize.define('wishlists', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    type_discount: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 1 },
    discount: { type: DataTypes.FLOAT, allowNull: true, defaultValue: 0 },
    cantidad: { type: DataTypes.INTEGER, allowNull: false },
    code_cupon: { type: DataTypes.STRING, allowNull: true },
    code_discount: { type: DataTypes.STRING, allowNull: true },
    price_unitario: { type: DataTypes.STRING, allowNull: false },
    subtotal: { type: DataTypes.STRING, allowNull: false },
    total: { type: DataTypes.STRING, allowNull: false }
}, {
    timestamps: true,
    tableName: 'wishlists'
});

// Define las asociaciones con los modelos de Usuario, Producto, y Variedad
Wishlist.belongsTo(User, { foreignKey: 'userId' });
Wishlist.belongsTo(Product, { foreignKey: 'productId' });
Wishlist.belongsTo(Variedad, { foreignKey: 'variedadId', allowNull: true });
