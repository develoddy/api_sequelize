import { DataTypes } from 'sequelize';
import { sequelize } from '../database/database.js'; 

export const Slider = sequelize.define('sliders', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    title: { type: DataTypes.STRING(250), allowNull: false },
    subtitle: { type: DataTypes.STRING(250), allowNull: true },
    description: { type: DataTypes.STRING(500), allowNull: true },
    position: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'middle-left' },
    link: { type: DataTypes.STRING(250), allowNull: false },
    imagen_mobile: { type: DataTypes.STRING(250), allowNull: false },
    imagen_desktop: { type: DataTypes.STRING(250), allowNull: false },
    state: { type: DataTypes.INTEGER, defaultValue: 1, validate: { min: 0, max: 99 } }
}, {
    timestamps: true,
    tableName: 'sliders'
});


