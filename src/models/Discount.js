import { DataTypes } from 'sequelize';
import { sequelize } from '../database/database.js';
import { DiscountProduct } from './DiscountProduct.js';
import { DiscountCategorie } from './DiscountCategorie.js';

export const Discount = sequelize.define('discounts', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    type_campaign: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    type_discount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    discount: { type: DataTypes.FLOAT, allowNull: false },
    start_date: { type: DataTypes.DATE, allowNull: false },
    end_date: { type: DataTypes.DATE, allowNull: false },
    start_date_num: { type: DataTypes.BIGINT, allowNull: false },
    end_date_num: { type: DataTypes.BIGINT, allowNull: false },
    state: { type: DataTypes.INTEGER, defaultValue: 1 },
    type_segment: { type: DataTypes.INTEGER, defaultValue: 1 }
}, {
    timestamps: true,
    tableName: 'discounts'
});

Discount.hasMany(DiscountProduct, { foreignKey: 'discountId' });
Discount.hasMany(DiscountCategorie, { foreignKey: 'discountId' });

// // Relación muchos a muchos entre Descuento y Producto
// const DiscountProduct = sequelize.define('discount_product', {
//     discountId: { type: DataTypes.INTEGER, allowNull: false },
//     productId: { type: DataTypes.INTEGER, allowNull: false }
// }, {
//   timestamps: false
// });

// Discount.belongsToMany(Product, { through: DiscountProduct, foreignKey: 'discountId' });
// Product.belongsToMany(Discount, { through: DiscountProduct, foreignKey: 'productId' });

// // Relación muchos a muchos entre Descuento y Categoría
// const DiscountCategory = sequelize.define('discount_category', {
//     discountId: { type: DataTypes.INTEGER, allowNull: false },
//     categoryId: { type: DataTypes.INTEGER, allowNull: false }
// }, {
//     timestamps: false
// });

// Discount.belongsToMany(Categorie, { through: DiscountCategory, foreignKey: 'discountId' });
// Categorie.belongsToMany(Discount, { through: DiscountCategory, foreignKey: 'categoryId' });

