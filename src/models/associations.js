

import { Product } from './Product.js';
import { Categorie } from './Categorie.js';
import { Galeria } from './Galeria.js';
//
// 📡 Relación Product con Categoria 
// Si ya tienes una tabla addressGuest, agrégale una relación con guests:
//

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



import { Guest } from './Guest.js';
import { AddressGuest } from './AddressGuest.js';
//
// 📡 Relación Guests con AddressGuest
// Si ya tienes una tabla addressGuest, agrégale una relación con guests:
//
Guest.hasMany(AddressGuest, { foreignKey: 'guest_id', onDelete: 'CASCADE' });
AddressGuest.belongsTo(Guest, { foreignKey: 'guest_id' });