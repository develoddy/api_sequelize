

import { Product } from './Product.js';
import { Categorie } from './Categorie.js';
import { Galeria } from './Galeria.js';
import { Guest } from './Guest.js';
import { User } from './User.js';
import { AddressGuest } from './AddressGuest.js';
import { CartCache } from './CartCache.js';
import { Variedad } from './Variedad.js';
import { Sale } from './Sale.js';
import { SaleDetail } from './SaleDetail.js';
import { SaleAddress } from './SaleAddress.js';
import { DiscountProduct } from './DiscountProduct.js';
import { ReturnRequest } from './ReturnRequest.js';
import { Inbox } from './Inbox.js';
import { PrelaunchSubscriber } from './PrelaunchSubscriber.js';
import { PrintfulWebhookLog } from './PrintfulWebhookLog.js';
import RetryQueue from './RetryQueue.js';

/*
 * RELACIÓN PRODUCT -> CATEGORIE
 * RELACIÇON CATEGORIE -> PRODUCT
 * RELACIÇON CATEGORIE -> GALERIA
 */
Product.belongsTo(Categorie, { foreignKey: 'categoryId', sourceKey: 'id'});
Categorie.hasMany(Product, { foreignKey: 'categoryId', sourceKey: 'id'});
DiscountProduct.belongsTo(Product, { foreignKey: 'productId' });
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
//Guest.hasMany(CartCache, { foreignKey: 'guest_id', onDelete: 'CASCADE' });
Guest.hasMany(CartCache, { foreignKey: 'guest_id', onDelete: 'CASCADE' });
CartCache.belongsTo(Guest, { foreignKey: 'guest_id' });
CartCache.belongsTo(Product, { foreignKey: 'productId' });
CartCache.belongsTo(Variedad, { foreignKey: 'variedadId', allowNull: true });

/*
 * SALE
 * RELACION SALE -> USER
 * RELACION SALE -> GUEST
 *
 */
Sale.belongsTo(User, { foreignKey: 'userId' });
Sale.belongsTo(Guest, { foreignKey: 'guestId' });
// Relaciones inversas para eager loading
Sale.hasMany(SaleDetail, { foreignKey: 'saleId' });
Sale.hasMany(SaleAddress, { foreignKey: 'saleId' });


/*
 * RETURN REQUEST
 * RELACION RETURN -> SALE
 * RELACION RETURN -> USER
 */
ReturnRequest.belongsTo(Sale, { foreignKey: 'saleId', as: 'sale' });
ReturnRequest.belongsTo(User, { foreignKey: 'userId', as: 'user' });

/*
 * RETURN Inbox
 * RELACION RETURN -> USER
 */
Inbox.belongsTo(User, { foreignKey: 'userId' });
Inbox.belongsTo(Guest, { foreignKey: 'guestId' });
Inbox.belongsTo(Inbox, { foreignKey: 'replyToId', as: 'parent' });
Inbox.hasMany(Inbox, { foreignKey: 'replyToId', as: 'replies' });

/*
 * RETRY QUEUE
 * RELACION RETRY_QUEUE -> SALE
 */
RetryQueue.belongsTo(Sale, { foreignKey: 'saleId' });
Sale.hasMany(RetryQueue, { foreignKey: 'saleId' });