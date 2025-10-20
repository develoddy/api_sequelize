import { DataTypes } from 'sequelize';
import { sequelize } from '../database/database.js'; 
import { Product } from './Product.js';

export const Categorie = sequelize.define('categories', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  title: { type: DataTypes.STRING(250), allowNull: false },
  imagen: { type: DataTypes.STRING(250), allowNull: false }, // imagen interna de Printful o por defecto
  custom_image: { type: DataTypes.STRING(250), allowNull: true },
  state: { type: DataTypes.INTEGER, defaultValue: 1, validate: { min: 1, max: 99 } }
}, {
  timestamps: true,
  tableName: 'categories'
});

// Eelación inversa con Productos:
/*Categorie.hasMany(Product, {
  foreignKey: 'categoryId',
  sourceKey: 'id',
});*/