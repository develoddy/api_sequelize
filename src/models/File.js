import { DataTypes } from 'sequelize';
import { sequelize } from '../database/database.js';
import { Variedad } from './Variedad.js';

export const File = sequelize.define('files', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  idFile: { type: DataTypes.INTEGER, allowNull: false },
  type: { type: DataTypes.STRING, allowNull: false },
  hash: { type: DataTypes.STRING, allowNull: false },
  url: { type: DataTypes.TEXT, allowNull: true },
  filename: { type: DataTypes.STRING, allowNull: false },
  mime_type: { type: DataTypes.STRING, allowNull: false },
  size: { type: DataTypes.INTEGER, allowNull: false },
  width: { type: DataTypes.INTEGER, allowNull: false },
  height: { type: DataTypes.INTEGER, allowNull: false },
  dpi: { type: DataTypes.INTEGER, allowNull: true },
  status: { type: DataTypes.STRING, allowNull: false },
  created: { type: DataTypes.INTEGER, allowNull: false },
  thumbnail_url: { type: DataTypes.STRING, allowNull: true },
  preview_url: { type: DataTypes.STRING, allowNull: true },
  visible: { type: DataTypes.BOOLEAN, allowNull: false },
  is_temporary: { type: DataTypes.BOOLEAN, allowNull: false },
  message: { type: DataTypes.STRING, allowNull: true },
  optionVarietyId: { type: DataTypes.INTEGER, allowNull: false } // Campo adicional para diferenciar las opciones
}, {
  timestamps: true,
  tableName: 'files'
});
