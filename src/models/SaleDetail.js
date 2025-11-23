import { DataTypes } from 'sequelize';
import { sequelize } from '../database/database.js';
import { Sale } from './Sale.js'; 
import { Product } from './Product.js'; 
import { Variedad } from './Variedad.js'; 

export const SaleDetail = sequelize.define('sale_details', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  type_discount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  discount: { type: DataTypes.FLOAT, defaultValue: 0 },
  cantidad: { type: DataTypes.INTEGER, allowNull: false },
  code_cupon: { type: DataTypes.STRING, allowNull: true },
  code_discount: { type: DataTypes.STRING, allowNull: true },
  type_campaign: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null }, // 1=Campaign Discount, 2=Flash Sale, 3=Cupón
  price_unitario: { type: DataTypes.FLOAT, allowNull: false },
  subtotal: { type: DataTypes.FLOAT, allowNull: false },
  total: { type: DataTypes.FLOAT, allowNull: false }
}, {
  timestamps: true,
  tableName: 'sale_details'
});

// Define las asociaciones con los modelos de Venta, Producto y Variedad

/* 

SaleDetail.belongsTo(Sale, { foreignKey: 'saleId' });: Esta línea establece una relación de "pertenencia a" entre el modelo SaleDetail y el modelo Sale. 
Indica que cada registro en la tabla SaleDetail pertenece a una venta específica representada por un registro en la tabla Sale. El argumento { foreignKey: 'saleId' } 
especifica que la relación se basa en el campo saleId en la tabla SaleDetail, que actúa como la clave externa para la relación con la tabla Sale.

SaleDetail.belongsTo(Product, { foreignKey: 'productId' });: Esta línea establece una relación de "pertenencia a" entre el modelo SaleDetail y el modelo Product. 
Indica que cada registro en la tabla SaleDetail pertenece a un producto específico representado por un registro en la tabla Product. El argumento { foreignKey: 'productId' } 
especifica que la relación se basa en el campo productId en la tabla SaleDetail, que actúa como la clave externa para la relación con la tabla Product.

SaleDetail.belongsTo(Variedad, { foreignKey: 'variedadId' });: Esta línea establece una relación de "pertenencia a" entre el modelo SaleDetail y el modelo Variedad. 
Indica que cada registro en la tabla SaleDetail puede pertenecer opcionalmente a una variedad específica representada por un registro en la tabla Variedad. El argumento { foreignKey: 'variedadId' } 
especifica que la relación se basa en el campo variedadId en la tabla SaleDetail, que actúa como la clave externa para la relación con la tabla Variedad.
*/
SaleDetail.belongsTo(Sale, { foreignKey: 'saleId' });
SaleDetail.belongsTo(Product, { foreignKey: 'productId' });
SaleDetail.belongsTo(Variedad, { foreignKey: 'variedadId' });

