import express from "express";
import cors from "cors";
import fs from 'fs';
import path from "path";
// import productsRoutes from './routes/products.routes.js';
// import usersRoutes from './routes/users.routes.js';

import { fileURLToPath } from 'url';

import router from './routes/index.js';

// Las variables de entorno ya están cargadas por index.js
const app = express();

// CORS configurado para producción
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? [
        process.env.URL_FRONTEND,   // http://tienda.lujandev.com
        process.env.URL_ADMIN,      // https://admin.lujandev.com
      ].filter(Boolean)
    : true, // Permitir todo en desarrollo
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'token', 'x-guest-data']
};

app.use(cors(corsOptions));

// 🚨 Sentry tracing middleware (debe ir ANTES de las rutas)
import { sentryTracingMiddleware } from './config/sentry.js';
app.use(sentryTracingMiddleware());

// -------------------- __dirname para ES Modules --------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// -------------------- Middleware CRÍTICO: Stripe webhook ANTES de express.json() --------------------
// 🔴 IMPORTANTE: Las rutas de Stripe deben registrarse ANTES del middleware express.json()
// porque Stripe requiere el body RAW (buffer) para validar firmas
import stripeRoutes from './routes/stripe.routes.js';
app.use('/api/stripe', stripeRoutes);

// -------------------- Middleware para Printful Webhook --------------------
app.post('/api/printful-webhook/webhook', express.json({
  limit: '50mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

// -------------------- Middleware global para JSON/urlencoded --------------------
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// -------------------- Middleware de cache --------------------
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
});

// -------------------- Timeout --------------------
app.use((req, res, next) => {
    req.setTimeout(5 * 60 * 1000); // 5 minutos (en milisegundos)
    next();
});

// -------------------- Ruta index --------------------
app.get('/', (req, res) => {
  const indexPath = path.join(__dirname, 'public', 'index.html');
  let html = fs.readFileSync(indexPath, 'utf8');

  html = html.replace(/{{URL_BACKEND}}/g, process.env.URL_BACKEND);

  res.send(html);
});

// -------------------- Enterprise Monitoring Endpoints --------------------
// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    database: 'connected',
    services: {
      stripe: !!process.env.STRIPE_SECRET_KEY,
      printful: !!process.env.PRINTFUL_API_TOKEN
    }
  });
});

// 🧪 Sentry test endpoint (solo en desarrollo)
app.get('/sentry-test', (req, res) => {
  if (process.env.NODE_ENV !== 'production') {
    import('./config/sentry.js').then(({ testSentryBackend }) => {
      testSentryBackend();
      res.json({ 
        message: 'Sentry backend test executed', 
        timestamp: new Date().toISOString(),
        check: 'See Sentry dashboard for results'
      });
    });
  } else {
    res.status(404).json({ error: 'Endpoint not available in production' });
  }
});

// Dashboard HTML
app.get('/dashboard.html', (req, res) => {
  const dashboardPath = path.join(__dirname, 'public', 'dashboard.html');
  
  if (fs.existsSync(dashboardPath)) {
    res.sendFile(dashboardPath);
  } else {
    res.status(404).json({ 
      error: 'Dashboard not found',
      message: 'El archivo dashboard.html no existe en public/',
      path: dashboardPath
    });
  }
});

// Métricas JSON para Dashboard
app.get('/metrics/latest.json', (req, res) => {
  const metricsPath = path.join(__dirname, '../metrics/latest.json');
  
  if (fs.existsSync(metricsPath)) {
    try {
      const data = fs.readFileSync(metricsPath, 'utf8');
      const jsonData = JSON.parse(data);
      res.json(jsonData);
    } catch (error) {
      res.status(500).json({ 
        error: 'Error reading metrics',
        message: error.message 
      });
    }
  } else {
    res.status(404).json({ 
      error: 'Metrics not found',
      message: 'Ejecuta: bash scripts/checkProductionHealth.sh',
      path: metricsPath
    });
  }
});

// -------------------- Archivos estáticos --------------------
// Servir uploads desde /api/public (para screenshots de módulos, etc)
app.use(express.static(path.join(__dirname, '..', 'public')));
// Servir assets desde /api/src/public (index.html, dashboard.html, etc)
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api/', router);

// -------------------- Email template --------------------
app.use('/assets', express.static(path.join(__dirname, 'src/assets')));
app.get('/email-resetpassword', (req, res) => {
  res.sendFile(path.join(__dirname, 'mails/email_resetpassword.html'));
});
app.get('/email-resetpassword-admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'mails/email_resetpassword_admin.html'));
});

// 🚨 Sentry error handler (debe ir AL FINAL, después de todas las rutas)
import { sentryErrorHandler } from './config/sentry.js';
app.use(sentryErrorHandler());

export default app
