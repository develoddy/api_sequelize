import { DataTypes } from 'sequelize';
import { sequelize } from '../database/database.js';
import { Categorie } from './Categorie.js';
import { Galeria } from './Galeria.js';

export const Product = sequelize.define('products', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    idProduct: { type: DataTypes.STRING },
    title: { type: DataTypes.STRING(250), allowNull: false },
    slug: { type: DataTypes.STRING(1000), allowNull: false },
    sku: { type: DataTypes.STRING, allowNull: false },
    price_soles: { type: DataTypes.FLOAT, allowNull: false },
    price_usd: { type: DataTypes.FLOAT, allowNull: false },
    portada: { type: DataTypes.STRING, allowNull: false },
    //galerias: { type: DataTypes.JSON, allowNull: true },
    state: { type: DataTypes.INTEGER, defaultValue: 1 },
    stock: { type: DataTypes.INTEGER, defaultValue: 0 },
    description: { type: DataTypes.TEXT, allowNull: false },
    resumen: { type: DataTypes.TEXT, allowNull: false },
    tags: { type: DataTypes.STRING, allowNull: false },
    type_inventario: { type: DataTypes.INTEGER, defaultValue: 1 }
    // New propierties
    
}, {
    timestamps: true,
    tableName: 'products'
});

// Define la asociación con el modelo de Categoría
// En este caso, establece que un producto pertenece a una categoría
Product.belongsTo( Categorie, { 
    foreignKey: 'categoryId',
    sourceKey: 'id',
});

// Define la asociación con el modelo de Galeria
Product.hasMany(Galeria, { 
    foreignKey: 'productId',
    sourceKey: 'id',
});

