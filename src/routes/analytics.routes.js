import { Router } from 'express';
import auth from '../middlewares/auth.js';
import {
  getDashboard,
  getMetrics,
  getLatest,
  calculateMetrics,
  recalculate,
  getProducts,
  getTopProductsList,
  getCosts,
  getSaleCosts,
  getProductCost,
  syncCosts,
  compare,
  invalidateCacheEndpoint,
  cleanCache,
  exportMetrics,
  exportProducts,
  exportCosts,
  exportFulfillment,
  exportFailures,
  getExecutiveReport,
  cleanExports
} from '../controllers/proveedor/analytics.controller.js';

const router = Router();

/**
 * Testing Endpoints (Sin autenticación - Solo para desarrollo)
 */
router.post('/test/calculate', calculateMetrics);
router.get('/test/dashboard', getDashboard);

/**
 * Dashboard y Resúmenes
 */
router.get('/dashboard', auth.verifyAdmin, getDashboard);
router.get('/latest/:type', auth.verifyAdmin, getLatest);

/**
 * Métricas Generales
 */
router.get('/metrics', auth.verifyAdmin, getMetrics);
router.post('/calculate', auth.verifyAdmin, calculateMetrics);
router.post('/recalculate', auth.verifyAdmin, recalculate);
router.post('/compare', auth.verifyAdmin, compare);

/**
 * Productos
 */
router.get('/products', auth.verifyAdmin, getProducts);
router.get('/top-products', auth.verifyAdmin, getTopProductsList);
router.get('/product-cost/:productId', auth.verifyAdmin, getProductCost);

/**
 * Costos
 */
router.get('/costs', auth.verifyAdmin, getCosts);
router.get('/sale-costs/:saleId', auth.verifyAdmin, getSaleCosts);
router.post('/sync-costs', auth.verifyAdmin, syncCosts);

/**
 * Cache Management
 */
router.delete('/cache', auth.verifyAdmin, invalidateCacheEndpoint);
router.post('/clean-cache', auth.verifyAdmin, cleanCache);

/**
 * Export & Reports
 */
router.post('/export/metrics', auth.verifyAdmin, exportMetrics);
router.post('/export/products', auth.verifyAdmin, exportProducts);
router.post('/export/costs', auth.verifyAdmin, exportCosts);
router.post('/export/fulfillment', auth.verifyAdmin, exportFulfillment);
router.post('/export/failures', auth.verifyAdmin, exportFailures);
router.post('/export/clean', auth.verifyAdmin, cleanExports);
router.post('/reports/executive', auth.verifyAdmin, getExecutiveReport);

export default router;
