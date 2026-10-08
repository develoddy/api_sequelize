import express from 'express';
import {
  getPostalCodeInfo,
  validateCombination,
  getProvincesByCountry,
  getStats,
  searchByCity
} from '../controllers/postalCode.controller.js';

const router = express.Router();

// ⚠️ IMPORTANTE: Las rutas específicas DEBEN ir ANTES de las rutas con parámetros dinámicos
// Si /:country/:postalCode va primero, capturará /provinces/ES como país=provinces, postalCode=ES

/**
 * @route   POST /api/postal-codes/validate
 * @desc    Valida la combinación de país, CP, ciudad y provincia
 * @access  Public
 * @body    { country, postalCode, city, province }
 */
router.post('/validate', validateCombination);

/**
 * @route   GET /api/postal-codes/stats
 * @desc    Obtiene estadísticas de la base de datos
 * @access  Public
 */
router.get('/stats', getStats);

/**
 * @route   GET /api/postal-codes/search
 * @desc    Busca códigos postales por ciudad
 * @access  Public
 * @query   country, city
 * @example GET /api/postal-codes/search?country=ES&city=madrid
 */
router.get('/search', searchByCity);

/**
 * @route   GET /api/postal-codes/provinces/:country
 * @desc    Obtiene todas las provincias de un país
 * @access  Public
 * @example GET /api/postal-codes/provinces/ES
 */
router.get('/provinces/:country', getProvincesByCountry);

/**
 * @route   GET /api/postal-codes/:country/:postalCode
 * @desc    Obtiene información de un código postal (provincia, ciudades)
 * @access  Public
 * @example GET /api/postal-codes/ES/28013
 * ⚠️ Esta ruta va al FINAL porque captura cualquier /:param1/:param2
 */
router.get('/:country/:postalCode', getPostalCodeInfo);

export default router;
