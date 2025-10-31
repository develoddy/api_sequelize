import { DataTypes } from 'sequelize';
import { sequelize } from '../database/database.js';
import { User } from './User.js';
import { Guest } from './Guest.js';

export const CheckoutCache = sequelize.define('checkout_cache', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  userId: { type: DataTypes.INTEGER, allowNull: true },
  guestId: { type: DataTypes.INTEGER, allowNull: true },
  cart: { type: DataTypes.TEXT('long'), allowNull: false }, // store full cart JSON
}, {
  timestamps: true,
  tableName: 'checkout_cache'
});

// Associations (optional)
CheckoutCache.belongsTo(User, { foreignKey: 'userId' });
CheckoutCache.belongsTo(Guest, { foreignKey: 'guestId' });

export default CheckoutCache;
