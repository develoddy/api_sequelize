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
    printful_ignored: {type: DataTypes.BOOLEAN, allowNull: true, defaultValue: false},
    stock: { type: DataTypes.INTEGER, defaultValue: 0 },
    // Descripciones multilenguaje
    description_en: { type: DataTypes.TEXT, allowNull: false },  // Inglés original
    description_es: { type: DataTypes.TEXT, allowNull: false },  // Traducción español
    resumen: { type: DataTypes.TEXT, allowNull: false },
    tags: { type: DataTypes.STRING, allowNull: false },
    type_inventario: { type: DataTypes.INTEGER, defaultValue: 1 },
    logo_position: { type: DataTypes.STRING, allowNull: true, defaultValue: 'center', validate: { isIn: [['center', 'right_top', 'left_top', 'back_center']]}}
    
}, {
    timestamps: true,
    tableName: 'products'
});

