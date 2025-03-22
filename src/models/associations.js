// src/models/associations.js
import { Product } from './Product.js';
import { Categorie } from './Categorie.js';
import { Galeria } from './Galeria.js';

// Relación Producto -> Categoría
Product.belongsTo(Categorie, { 
  foreignKey: 'categoryId',
  sourceKey: 'id',
});

// Relación Categoría -> Productos
Categorie.hasMany(Product, { 
  foreignKey: 'categoryId',
  sourceKey: 'id',
});

// Relación Producto -> Galeria
Product.hasMany(Galeria, { 
  foreignKey: 'productId',
  sourceKey: 'id',
});
