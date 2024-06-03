import { DataTypes } from 'sequelize';
import { sequelize } from '../database/database.js';
import { Product } from './Product.js'; 

export const Variedad = sequelize.define('variedades', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  valor: { type: DataTypes.STRING, allowNull: false },
  stock: { type: DataTypes.INTEGER, allowNull: false }
}, {
  timestamps: true,
  tableName: 'variedades'
});

// Define la asociación con el modelo de Producto
// belongsTo: En este caso, establece que una variedad de producto pertenece a un producto específico.
//Variedad.belongsTo(Product, { foreignKey: 'productId' });
Variedad.belongsTo(Product, { foreignKey: 'productId', targetKey: 'id' });
Product.hasMany(Variedad, { foreignKey: 'productId', sourceKey: 'id' });


