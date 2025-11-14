import { DataTypes } from 'sequelize';
import { sequelize } from '../database/database.js';
import { CuponeProduct } from './CuponeProduct.js';
import { CuponeCategorie } from './CuponeCategorie.js';

export const Cupone = sequelize.define('cupones', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    code: { type: DataTypes.STRING(50), allowNull: false },
    type_discount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    discount: { type: DataTypes.FLOAT, allowNull: false },
    type_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    num_use: { type: DataTypes.INTEGER, allowNull: true },
    type_segment: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    state: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
}, {
  timestamps: true,
  tableName: 'cupones'
});

Cupone.hasMany(CuponeProduct, { foreignKey: 'cuponeId' });
Cupone.hasMany(CuponeCategorie, { foreignKey: 'cuponeId' });
