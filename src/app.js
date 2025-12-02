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
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));

// -------------------- __dirname para ES Modules --------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// -------------------- Middleware para Stripe Webhook --------------------
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), (req, res, next) => {
  console.log('[App] Stripe webhook request hit', req.method, req.originalUrl);
  console.log('[App] Raw body isBuffer:', Buffer.isBuffer(req.body), 'length:', req.body.length);
  next();
});

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

// -------------------- Archivos estáticos --------------------
app.use(express.static(path.join(__dirname,'public')));
app.use('/api/', router);

// -------------------- Email template --------------------
app.use('/assets', express.static(path.join(__dirname, 'src/assets')));
app.get('/email-resetpassword', (req, res) => {
  res.sendFile(path.join(__dirname, 'mails/email_resetpassword.html'));
});

export default app
