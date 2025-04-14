

import { Product } from './Product.js';
import { Categorie } from './Categorie.js';
import { Galeria } from './Galeria.js';
import { Guest } from './Guest.js';
import { AddressGuest } from './AddressGuest.js';
import { CartCache } from './CartCache.js';
import { Variedad } from './Variedad.js';

/*
 * RELACIÓN PRODUCT -> CATEGORIE
 * RELACIÇON CATEGORIE -> PRODUCT
 * RELACIÇON CATEGORIE -> GALERIA
 */
Product.belongsTo(Categorie, { foreignKey: 'categoryId', sourceKey: 'id'});
Categorie.hasMany(Product, { foreignKey: 'categoryId', sourceKey: 'id'});
Product.hasMany(Galeria, { foreignKey: 'productId', sourceKey: 'id'});

/*
 * RELACIÓN GUEST -> ADDRESSGUEST
 * RELACION ADDRESSGUEST -> GUEST
 */
Guest.hasMany(AddressGuest, { foreignKey: 'guest_id', onDelete: 'CASCADE' });
AddressGuest.belongsTo(Guest, { foreignKey: 'guest_id' });

/*
 * RELACIÓN GUEST -> CARTCACHE
 * RELACION CARTCACHE -> GUEST
 * RELACION CARTCACHE -> PRODUCT
 * RELACION CARTCACHE -> VARIEDAD
 */
Guest.hasMany(CartCache, { foreignKey: 'guest_id', onDelete: 'CASCADE' });
CartCache.belongsTo(Guest, { foreignKey: 'guest_id' });
CartCache.belongsTo(Product, { foreignKey: 'productId' });
CartCache.belongsTo(Variedad, { foreignKey: 'variedadId', allowNull: true });