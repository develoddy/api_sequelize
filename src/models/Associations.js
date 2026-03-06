

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
import AnalyticsCache from './AnalyticsCache.js';
import ProductAnalytics from './ProductAnalytics.js';
import { Module } from './Module.js';
import { Tenant } from './Tenant.js';
import { TenantNote } from './TenantNote.js';

/*
 * RELACIÓN TENANT -> MODULE
 * Un tenant pertenece a un módulo SaaS
 */
Tenant.belongsTo(Module, { 
  foreignKey: 'module_key', 
  targetKey: 'key',
  as: 'module' 
});
Module.hasMany(Tenant, { 
  foreignKey: 'module_key',
  sourceKey: 'key',
  as: 'tenants' 
});

/*
 * RELACIÓN TENANT -> TENANT_NOTES
 * Un tenant puede tener múltiples notas administrativas
 */
Tenant.hasMany(TenantNote, { 
  foreignKey: 'tenant_id', 
  as: 'notes' 
});
TenantNote.belongsTo(Tenant, { 
  foreignKey: 'tenant_id', 
  as: 'tenant' 
});

/*
 * RELACIÓN MODULE -> PRODUCT, SALE, SALE_DETAIL
 * Un módulo puede tener múltiples productos, ventas y detalles
 */
Module.hasMany(Product, { foreignKey: 'module_id', as: 'products' });
Product.belongsTo(Module, { foreignKey: 'module_id', as: 'module' });

Module.hasMany(Sale, { foreignKey: 'module_id', as: 'sales' });
Sale.belongsTo(Module, { foreignKey: 'module_id', as: 'module' });

Module.hasMany(SaleDetail, { foreignKey: 'module_id', as: 'saleDetails' });
// SaleDetail.belongsTo ya está definido en SaleDetail.js - no duplicar

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

/*
 * PRODUCT ANALYTICS
 * RELACION PRODUCT_ANALYTICS -> PRODUCT
 */
ProductAnalytics.belongsTo(Product, { foreignKey: 'productId' });
Product.hasMany(ProductAnalytics, { foreignKey: 'productId' });

/*
 * CHAT CONVERSATION
 * RELACION CHAT_CONVERSATION -> USER
 * RELACION CHAT_CONVERSATION -> GUEST
 */
import { ChatConversation } from './chat/ChatConversation.js';

ChatConversation.belongsTo(User, { 
  foreignKey: 'user_id', 
  as: 'user',
  constraints: false 
});

ChatConversation.belongsTo(Guest, { 
  foreignKey: 'guest_id',
  as: 'guest',
  constraints: false
});

User.hasMany(ChatConversation, { 
  foreignKey: 'user_id',
  as: 'conversations',
  constraints: false
});

Guest.hasMany(ChatConversation, { 
  foreignKey: 'guest_id',
  as: 'conversations',
  constraints: false
});

/*
 * FINANCIAL MODULE
 * RELACIONES BANK_ACCOUNT -> USER
 * RELACIONES INCOME -> USER, BANK_ACCOUNT
 * RELACIONES EXPENSE -> USER, BANK_ACCOUNT  
 * RELACIONES DEBT -> USER
 * RELACIONES ASSET -> USER, BANK_ACCOUNT (patrimonio)
 * RELACIONES LIABILITY -> USER (patrimonio)
 */
import { BankAccount } from './BankAccount.js';
import { Income } from './Income.js';
import { Expense } from './Expense.js';
import { Debt } from './Debt.js';
import { Asset } from './Asset.js';
import { Liability } from './Liability.js';

// BankAccount relationships
User.hasMany(BankAccount, { 
  foreignKey: 'user_id', 
  as: 'bankAccounts',
  onDelete: 'CASCADE'
});
BankAccount.belongsTo(User, { 
  foreignKey: 'user_id', 
  as: 'user' 
});

// Income relationships
User.hasMany(Income, { 
  foreignKey: 'user_id', 
  as: 'incomes',
  onDelete: 'CASCADE'
});
Income.belongsTo(User, { 
  foreignKey: 'user_id', 
  as: 'user' 
});
Income.belongsTo(BankAccount, { 
  foreignKey: 'bank_account_id', 
  as: 'bankAccount',
  constraints: false
});
BankAccount.hasMany(Income, { 
  foreignKey: 'bank_account_id', 
  as: 'incomes'
});

// Expense relationships
User.hasMany(Expense, { 
  foreignKey: 'user_id', 
  as: 'expenses',
  onDelete: 'CASCADE'
});
Expense.belongsTo(User, { 
  foreignKey: 'user_id', 
  as: 'user' 
});
Expense.belongsTo(BankAccount, { 
  foreignKey: 'bank_account_id', 
  as: 'bankAccount',
  constraints: false
});
BankAccount.hasMany(Expense, { 
  foreignKey: 'bank_account_id', 
  as: 'expenses'
});

// Expense - BankAccount relationship for internal transfers (target account)
Expense.belongsTo(BankAccount, { 
  foreignKey: 'target_account_id', 
  as: 'targetAccount',
  constraints: false
});
BankAccount.hasMany(Expense, { 
  foreignKey: 'target_account_id', 
  as: 'incomingTransfers'
});

// Income - BankAccount relationship for internal transfers (source account)
Income.belongsTo(BankAccount, { 
  foreignKey: 'source_account_id', 
  as: 'sourceAccount',
  constraints: false
});
BankAccount.hasMany(Income, { 
  foreignKey: 'source_account_id', 
  as: 'outgoingTransfers'
});

// Debt relationships
User.hasMany(Debt, { 
  foreignKey: 'user_id', 
  as: 'debts',
  onDelete: 'CASCADE'
});
Debt.belongsTo(User, { 
  foreignKey: 'user_id', 
  as: 'user' 
});

// Debt - BankAccount relationship (cuenta desde la que se paga)
BankAccount.hasMany(Debt, {
  foreignKey: 'bank_account_id',
  as: 'debts',
  onDelete: 'SET NULL'
});
Debt.belongsTo(BankAccount, {
  foreignKey: 'bank_account_id',
  as: 'bankAccount'
});

// Asset relationships (patrimonio)
User.hasMany(Asset, { 
  foreignKey: 'user_id', 
  as: 'assets',
  onDelete: 'CASCADE'
});
Asset.belongsTo(User, { 
  foreignKey: 'user_id', 
  as: 'user' 
});
Asset.belongsTo(BankAccount, { 
  foreignKey: 'bank_account_id', 
  as: 'bankAccount',
  constraints: false
});
BankAccount.hasMany(Asset, { 
  foreignKey: 'bank_account_id', 
  as: 'assets'
});

// Liability relationships (patrimonio)
User.hasMany(Liability, { 
  foreignKey: 'user_id', 
  as: 'liabilities',
  onDelete: 'CASCADE'
});
Liability.belongsTo(User, { 
  foreignKey: 'user_id', 
  as: 'user' 
});