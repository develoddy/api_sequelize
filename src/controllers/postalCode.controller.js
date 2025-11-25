import { PostalCode } from '../models/PostalCode.js';

/**
 * @desc    Obtiene información de un código postal específico
 * @route   GET /api/postal-codes/:country/:postalCode
 * @access  Public
 */
export const getPostalCodeInfo = async (req, res) => {
  try {
    const { country, postalCode } = req.params;
    
    console.log(`📍 [PostalCode Controller] GET /${country}/${postalCode}`);
    
    const result = await PostalCode.findByPostalCode(country.toUpperCase(), postalCode);
    
    if (!result.exists) {
      console.log(`❌ [PostalCode Controller] CP ${postalCode} not found in ${country}`);
      return res.status(404).json({
        exists: false,
        message: `Código postal ${postalCode} no encontrado en ${country}`
      });
    }
    
    console.log(`✅ [PostalCode Controller] CP ${postalCode} found:`, result);
    res.json(result);
    
  } catch (error) {
    console.error('❌ [PostalCode Controller] Error in getPostalCodeInfo:', error);
    res.status(500).json({
      error: 'Error al buscar código postal',
      details: error.message
    });
  }
};

/**
 * @desc    Valida la combinación de país, código postal, ciudad y provincia
 * @route   POST /api/postal-codes/validate
 * @access  Public
 */
export const validateCombination = async (req, res) => {
  try {
    const { country, postalCode, city, province } = req.body;
    
    console.log(`🔍 [PostalCode Controller] POST /validate`, req.body);
    
    if (!country || !postalCode || !city) {
      return res.status(400).json({
        valid: false,
        message: 'Faltan campos obligatorios: country, postalCode, city'
      });
    }
    
    const result = await PostalCode.validateCombination(
      country.toUpperCase(),
      postalCode,
      city,
      province
    );
    
    console.log(`✅ [PostalCode Controller] Validation result:`, result);
    res.json(result);
    
  } catch (error) {
    console.error('❌ [PostalCode Controller] Error in validateCombination:', error);
    res.status(500).json({
      valid: false,
      message: 'Error al validar dirección',
      details: error.message
    });
  }
};

/**
 * @desc    Obtiene todas las provincias de un país
 * @route   GET /api/postal-codes/provinces/:country
 * @access  Public
 */
export const getProvincesByCountry = async (req, res) => {
  try {
    const { country } = req.params;
    
    console.log(`📍 [PostalCode Controller] GET /provinces/${country}`);
    
    const provinces = await PostalCode.getProvincesByCountry(country.toUpperCase());
    
    console.log(`✅ [PostalCode Controller] Found ${provinces.length} provinces`);
    res.json({ provinces });
    
  } catch (error) {
    console.error('❌ [PostalCode Controller] Error in getProvincesByCountry:', error);
    res.status(500).json({
      error: 'Error al obtener provincias',
      details: error.message
    });
  }
};

/**
 * @desc    Obtiene estadísticas de la base de datos
 * @route   GET /api/postal-codes/stats
 * @access  Public
 */
export const getStats = async (req, res) => {
  try {
    console.log(`📊 [PostalCode Controller] GET /stats`);
    
    const stats = await PostalCode.getStats();
    
    console.log(`✅ [PostalCode Controller] Stats:`, stats);
    res.json(stats);
    
  } catch (error) {
    console.error('❌ [PostalCode Controller] Error in getStats:', error);
    res.status(500).json({
      error: 'Error al obtener estadísticas',
      details: error.message
    });
  }
};

/**
 * @desc    Busca códigos postales por ciudad
 * @route   GET /api/postal-codes/search?country=ES&city=madrid
 * @access  Public
 */
export const searchByCity = async (req, res) => {
  try {
    const { country, city } = req.query;
    
    console.log(`🔍 [PostalCode Controller] GET /search?country=${country}&city=${city}`);
    
    if (!country || !city) {
      return res.status(400).json({
        error: 'Parámetros obligatorios: country, city'
      });
    }
    
    const results = await PostalCode.searchByCity(country.toUpperCase(), city);
    
    console.log(`✅ [PostalCode Controller] Found ${results.length} results`);
    res.json(results);
    
  } catch (error) {
    console.error('❌ [PostalCode Controller] Error in searchByCity:', error);
    res.status(500).json({
      error: 'Error al buscar por ciudad',
      details: error.message
    });
  }
};
