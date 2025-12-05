// 🏥 HEALTH CHECK ENDPOINT PARA TESTING
// Archivo: /api/src/routes/health.js (crear si no existe)

const express = require('express');
const router = express.Router();

/**
 * GET /api/health
 * Endpoint básico de health check para validar que la API funciona
 */
router.get('/health', (req, res) => {
  try {
    const healthStatus = {
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0',
      services: {
        database: 'connected', // Verificar conexión DB real aquí
        printful: 'configured', // Verificar API key aquí
        stripe: 'configured',   // Verificar keys aquí
        email: 'configured'     // Verificar SMTP aquí
      },
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB'
      }
    };

    res.status(200).json(healthStatus);
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

/**
 * GET /api/health/deep
 * Health check más profundo que verifica conexiones reales
 */
router.get('/health/deep', async (req, res) => {
  try {
    const checks = {
      database: false,
      printful: false,
      stripe: false,
      email: false
    };

    // TODO: Implementar verificaciones reales
    // checks.database = await testDatabaseConnection();
    // checks.printful = await testPrintfulAPI();
    // checks.stripe = await testStripeAPI();
    // checks.email = await testEmailService();

    const allHealthy = Object.values(checks).every(check => check === true);

    res.status(allHealthy ? 200 : 503).json({
      status: allHealthy ? 'HEALTHY' : 'UNHEALTHY',
      timestamp: new Date().toISOString(),
      checks: checks
    });

  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

module.exports = router;

// INSTRUCCIONES DE INSTALACIÓN:
// 1. Crear archivo: /api/src/routes/health.js
// 2. En tu app.js principal, añadir:
//    const healthRoutes = require('./routes/health');
//    app.use('/api', healthRoutes);
// 3. Reiniciar servidor API
// 4. Probar: GET http://localhost:5000/api/health