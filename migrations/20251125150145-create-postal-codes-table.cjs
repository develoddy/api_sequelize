'use strict';

/**
 * Migration: Create postal_codes table
 * Tabla de códigos postales para validación de direcciones tipo Mango.es
 * 
 * @author Claude (GitHub Copilot)
 * @date 2025-11-25
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('📦 Creando tabla postal_codes...');
    
    await queryInterface.createTable('postal_codes', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      country: {
        type: Sequelize.STRING(2),
        allowNull: false,
        comment: 'Código ISO del país (ES, FR, DE, IT, PT, etc.)'
      },
      postal_code: {
        type: Sequelize.STRING(10),
        allowNull: false,
        comment: 'Código postal (formato según país)'
      },
      province: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Provincia / Estado / Región'
      },
      city: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Ciudad / Población / Municipio'
      },
      city_normalized: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Nombre normalizado de la ciudad (sin acentos, minúsculas)'
      },
      is_primary: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
        comment: 'Si es la ciudad principal del código postal'
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false,
        comment: 'Si el registro está activo'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      }
    });

    console.log('📊 Creando índices...');
    
    // Índice 1: Búsqueda rápida por país + código postal
    await queryInterface.addIndex('postal_codes', ['country', 'postal_code'], {
      name: 'idx_country_postal_code'
    });

    // Índice 2: Validación única de combinación país + CP + ciudad
    await queryInterface.addIndex('postal_codes', ['country', 'postal_code', 'city_normalized'], {
      name: 'idx_country_postal_code_city',
      unique: true
    });

    // Índice 3: Búsquedas por provincia
    await queryInterface.addIndex('postal_codes', ['province'], {
      name: 'idx_province'
    });

    // Índice 4: Búsquedas por ciudad normalizada
    await queryInterface.addIndex('postal_codes', ['city_normalized'], {
      name: 'idx_city_normalized'
    });

    // Índice 5: Filtrar solo registros activos
    await queryInterface.addIndex('postal_codes', ['is_active'], {
      name: 'idx_is_active'
    });

    console.log('✅ Tabla postal_codes creada con 5 índices optimizados');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('postal_codes');
    console.log('✅ Tabla postal_codes eliminada');
  }
};
