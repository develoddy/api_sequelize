import { DataTypes } from 'sequelize';
import { sequelize } from '../database/database.js';

/**
 * Modelo PostalCode
 * Tabla de códigos postales para validación de direcciones estilo Mango.es
 */
export const PostalCode = sequelize.define('postal_codes', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  country: {
    type: DataTypes.STRING(2),
    allowNull: false,
    comment: 'Código ISO del país (ES, FR, DE, IT, PT, etc.)'
  },
  postal_code: {
    type: DataTypes.STRING(10),
    allowNull: false,
    comment: 'Código postal (formato según país)'
  },
  province: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: 'Provincia / Estado / Región'
  },
  city: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: 'Ciudad / Población / Municipio'
  },
  city_normalized: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: 'Nombre normalizado de la ciudad (sin acentos, minúsculas)'
  },
  is_primary: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false,
    comment: 'Si es la ciudad principal del código postal'
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false,
    comment: 'Si el registro está activo'
  }
}, {
  tableName: 'postal_codes',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      name: 'idx_country_postal_code',
      fields: ['country', 'postal_code']
    },
    {
      name: 'idx_country_postal_code_city',
      fields: ['country', 'postal_code', 'city_normalized'],
      unique: true
    },
    {
      name: 'idx_province',
      fields: ['province']
    },
    {
      name: 'idx_city_normalized',
      fields: ['city_normalized']
    },
    {
      name: 'idx_is_active',
      fields: ['is_active']
    }
  ]
});

/**
 * Hook: Normalizar ciudad antes de guardar
 */
PostalCode.beforeSave((instance) => {
  if (instance.city) {
    instance.city_normalized = normalizeString(instance.city);
  }
});

/**
 * Método estático: Buscar por código postal
 * @param {string} country - Código ISO del país (ES, FR, etc.)
 * @param {string} postalCode - Código postal
 * @returns {Object} { exists, postalCode, province, cities: [{city, isPrimary}] }
 */
PostalCode.findByPostalCode = async function(country, postalCode) {
  try {
    const results = await PostalCode.findAll({
      where: {
        country: country.toUpperCase(),
        postal_code: postalCode,
        is_active: true
      },
      attributes: ['postal_code', 'province', 'city', 'is_primary'],
      raw: true
    });

    if (results.length === 0) {
      return {
        exists: false,
        postalCode: postalCode,
        province: null,
        cities: []
      };
    }

    // Agrupar ciudades del mismo CP
    const province = results[0].province;
    const cities = results.map(r => ({
      city: r.city,
      isPrimary: r.is_primary
    }));

    return {
      exists: true,
      postalCode: postalCode,
      province: province,
      cities: cities
    };
  } catch (error) {
    console.error('Error in findByPostalCode:', error);
    throw error;
  }
};

/**
 * Método estático: Validar combinación CP + Ciudad + Provincia
 * @param {string} country - Código ISO del país
 * @param {string} postalCode - Código postal
 * @param {string} city - Ciudad
 * @param {string} province - Provincia (opcional)
 * @returns {Object} { valid, message, details }
 */
PostalCode.validateCombination = async function(country, postalCode, city, province) {
  try {
    const cityNormalized = normalizeString(city);
    const provinceNormalized = province ? normalizeString(province) : null;

    const record = await PostalCode.findOne({
      where: {
        country: country.toUpperCase(),
        postal_code: postalCode,
        city_normalized: cityNormalized,
        is_active: true
      },
      raw: true
    });

    if (!record) {
      // Buscar si existe el CP pero con otra ciudad
      const cpExists = await PostalCode.findOne({
        where: {
          country: country.toUpperCase(),
          postal_code: postalCode,
          is_active: true
        },
        attributes: ['city', 'province'],
        raw: true
      });

      if (cpExists) {
        return {
          valid: false,
          message: `La ciudad "${city}" no corresponde al código postal ${postalCode}. La ciudad correcta es: ${cpExists.city}, ${cpExists.province}`
        };
      }

      return {
        valid: false,
        message: `El código postal ${postalCode} no existe en ${country}`
      };
    }

    // Validar provincia si se proporciona
    if (provinceNormalized && normalizeString(record.province) !== provinceNormalized) {
      return {
        valid: false,
        message: `La provincia "${province}" no corresponde al código postal ${postalCode}. La provincia correcta es: ${record.province}`
      };
    }

    return {
      valid: true,
      message: 'Dirección válida',
      details: {
        postalCode: record.postal_code,
        city: record.city,
        province: record.province,
        country: record.country
      }
    };
  } catch (error) {
    console.error('Error in validateCombination:', error);
    throw error;
  }
};

/**
 * Método estático: Obtener todas las provincias de un país
 * @param {string} country - Código ISO del país
 * @returns {Array<string>} Lista de provincias
 */
PostalCode.getProvincesByCountry = async function(country) {
  try {
    const results = await PostalCode.findAll({
      where: {
        country: country.toUpperCase(),
        is_active: true
      },
      attributes: [[sequelize.fn('DISTINCT', sequelize.col('province')), 'province']],
      order: [['province', 'ASC']],
      raw: true
    });

    return results.map(r => r.province);
  } catch (error) {
    console.error('Error in getProvincesByCountry:', error);
    throw error;
  }
};

/**
 * Método estático: Obtener estadísticas de la base de datos
 * @returns {Object} Estadísticas (total records, países, provincias, ciudades)
 */
PostalCode.getStats = async function() {
  try {
    const totalRecordsResult = await sequelize.query(
      'SELECT COUNT(*) as count FROM postal_codes WHERE is_active = true',
      { type: sequelize.QueryTypes.SELECT }
    );

    const countriesResult = await sequelize.query(
      'SELECT DISTINCT country FROM postal_codes WHERE is_active = true ORDER BY country',
      { type: sequelize.QueryTypes.SELECT }
    );

    const totalProvincesResult = await sequelize.query(
      'SELECT COUNT(DISTINCT province) as count FROM postal_codes WHERE is_active = true',
      { type: sequelize.QueryTypes.SELECT }
    );

    const totalCitiesResult = await sequelize.query(
      'SELECT COUNT(DISTINCT city_normalized) as count FROM postal_codes WHERE is_active = true',
      { type: sequelize.QueryTypes.SELECT }
    );

    return {
      totalRecords: totalRecordsResult[0].count,
      countries: countriesResult.map(c => c.country),
      totalProvinces: totalProvincesResult[0].count,
      totalCities: totalCitiesResult[0].count
    };
  } catch (error) {
    console.error('Error in getStats:', error);
    throw error;
  }
};

/**
 * Método estático: Buscar códigos postales por ciudad
 * @param {string} country - Código ISO del país
 * @param {string} city - Nombre de la ciudad (búsqueda flexible)
 * @returns {Array} Lista de códigos postales que coinciden
 */
PostalCode.searchByCity = async function(country, city) {
  try {
    const cityNormalized = normalizeString(city);

    const results = await PostalCode.findAll({
      where: {
        country: country.toUpperCase(),
        city_normalized: {
          [sequelize.Sequelize.Op.like]: `%${cityNormalized}%`
        },
        is_active: true
      },
      attributes: ['postal_code', 'province', 'city', 'is_primary'],
      order: [['postal_code', 'ASC']],
      raw: true
    });

    return results.map(r => ({
      postalCode: r.postal_code,
      city: r.city,
      province: r.province,
      isPrimary: r.is_primary
    }));
  } catch (error) {
    console.error('Error in searchByCity:', error);
    throw error;
  }
};

/**
 * Función auxiliar: Normalizar string (elimina acentos, minúsculas, espacios)
 */
function normalizeString(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Eliminar acentos
    .replace(/[^a-z0-9]/g, ''); // Solo letras y números
}

/**
 * Override toJSON para formato de respuesta
 */
PostalCode.prototype.toJSON = function() {
  const values = Object.assign({}, this.get());
  return {
    postalCode: values.postal_code,
    country: values.country,
    province: values.province,
    city: values.city,
    isPrimary: values.is_primary,
    isActive: values.is_active
  };
};
