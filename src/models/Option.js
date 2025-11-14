

import { DataTypes } from 'sequelize';
import { sequelize } from '../database/database.js';
import { Variedad } from './Variedad.js';
//import { Value } from './Value.js';
import { File } from './File.js';

export const Option = sequelize.define('Option', {
  id: {type: DataTypes.INTEGER,autoIncrement: true,primaryKey: true,},
  idOption: { type: DataTypes.STRING, allowNull: false },
  value: {type: DataTypes.JSON,
    allowNull: false,
    defaultValue: [], // Valor por defecto es un array vacío
    get() {
      const value = this.getDataValue('value');
      if (typeof value === 'string') {
        try {
          return JSON.parse(value); // Intenta parsear el string a JSON
        } catch (error) {
          return []; // Si hay un error, retorna un array vacío
        }
      }
      return value; // Retorna el valor como está si no es un string
    },
    set(value) {
      // Convierte el valor a JSON si es un array o lo deja como está si es otro tipo
      if (Array.isArray(value)) {
        this.setDataValue('value', JSON.stringify(value));
      } else {
        this.setDataValue('value', value);
      }
    },
  },
}, {
  timestamps: true,
  tableName: 'options',
});


/*export const Option = sequelize.define('options', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  value_single: { type: DataTypes.STRING, allowNull: true },
}, {
  timestamps: true,
  tableName: 'options'
});*/

// Define the association with Variedad
//Option.belongsTo(Variedad, { foreignKey: 'varietyId' });
//Variedad.hasMany(Option, { foreignKey: 'varietyId' });


//Option.belongsTo(Value, { foreignKey: 'valueId' });
//Value.hasMany(Option, { foreignKey: 'valueId' });