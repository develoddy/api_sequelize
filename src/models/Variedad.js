import { DataTypes } from 'sequelize';
import { sequelize } from '../database/database.js';
import { Product } from './Product.js'; 
import { ProductVariants } from './ProductVariants.js'; 
import { File } from './File.js'; 
import { Option } from './Option.js';

export const Variedad = sequelize.define('variedades', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  valor: { type: DataTypes.STRING, allowNull: false },
  stock: { type: DataTypes.INTEGER, allowNull: false },
  // New properties

  external_id: { type: DataTypes.STRING, allowNull: false },
  sync_product_id: { type: DataTypes.INTEGER, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false },
  synced: { type: DataTypes.BOOLEAN, allowNull: false },
  variant_id: { type: DataTypes.INTEGER, allowNull: false },
  main_category_id: { type: DataTypes.INTEGER, allowNull: false },
  warehouse_product_id: { type: DataTypes.INTEGER, allowNull: true },
  warehouse_product_variant_id: { type: DataTypes.INTEGER, allowNull: true },
  retail_price: { type: DataTypes.STRING, allowNull: false },
  sku: { type: DataTypes.STRING, allowNull: false },
  currency: { type: DataTypes.STRING, allowNull: false },

}, {
  timestamps: true,
  tableName: 'variedades'
});

// Define la asociación con el modelo de Producto
// belongsTo: En este caso, establece que una variedad de producto pertenece a un producto específico.
//Variedad.belongsTo(Product, { foreignKey: 'productId' });
Variedad.belongsTo(Product, { foreignKey: 'productId', targetKey: 'id' });
Product.hasMany(Variedad, { foreignKey: 'productId', sourceKey: 'id' });

// Define las asociaciones con los nuevos modelos
Variedad.hasOne(ProductVariants, { foreignKey: 'varietyId' });
ProductVariants.belongsTo(Variedad, { foreignKey: 'varietyId' });

Variedad.hasMany(File, { foreignKey: 'varietyId' });
File.belongsTo(Variedad, { foreignKey: 'varietyId' });

// Define la asociación con el modelo de Option
Option.belongsTo(Variedad, { foreignKey: 'varietyId' });
Variedad.hasMany(Option, { foreignKey: 'varietyId' });