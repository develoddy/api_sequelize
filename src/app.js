import express from "express";
import cors from "cors";
import fs from 'fs';
import path from "path";
import dotenv from 'dotenv';
// import productsRoutes from './routes/products.routes.js';
// import usersRoutes from './routes/users.routes.js';

import { fileURLToPath } from 'url';

import router from './routes/index.js';

//const app = express();
dotenv.config();
const app = express();
app.use(cors());



// -------------------- Límites de tamaño --------------------
// Nota: Stripe necesita que el body llegue como raw (Buffer) para verificar la firma.
// Por eso aplicamos un parser raw específicamente para la ruta del webhook ANTES
// de registrar el body-parser JSON global.
app.use((req, res, next) => {
  try {
    // Asegurarnos de que la ruta y método coinciden con el webhook
    if (req.originalUrl === '/api/stripe/webhook' && req.method === 'POST') {
      // Ejecutar express.raw sólo para este request y luego continuar al router
      return express.raw({ type: 'application/json' })(req, res, (err) => {
        if (err) {
          console.error('[App] Error parsing raw body for Stripe webhook:', err);
          return next(err);
        }
        console.log('[App] Raw body middleware applied for /api/stripe/webhook - headers:', JSON.stringify(req.headers || {}, null, 2));
        console.log('[App] Raw body type info - isBuffer:', Buffer.isBuffer(req.body), 'bodyLength:', req.body ? (req.body.length || JSON.stringify(req.body).length) : 0);
        return next();
      });
    }
  } catch (e) {
    console.error('[App] Exception in raw-webhook middleware:', e && (e.stack || e.message || e));
    // fallthrough to next so other middleware can handle
  }
  return next();
});

// Límite para el tamaño de las solicitudes (JSON/urlencoded)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// -------------------- __dirname para ES Modules --------------------
// Obtener __dirname en módulos ES
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


// -------------------- Middleware de cache --------------------
// Middleware para desactivar caché
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
});

// Establecer un timeout mayor (ej. 5 minutos)
app.use((req, res, next) => {
    req.setTimeout(5 * 60 * 1000); // 5 minutos (en milisegundos)
    next();
});

// Ruta para servir el index.html dinámico
app.get('/', (req, res) => {
  const indexPath = path.join(__dirname, 'public', 'index.html');
  let html = fs.readFileSync(indexPath, 'utf8');

  html = html.replace(/{{URL_BACKEND}}/g, process.env.URL_BACKEND);

  res.send(html);
});

// middlwares
//app.use(express.json());
app.use(express.static(path.join(__dirname,'public')));
app.use('/api/', router);

// Ruta para servir el archivo email_sale.html
app.use('/assets', express.static(path.join(__dirname, 'src/assets')));
app.get('/email-resetpassword', (req, res) => {
  res.sendFile(path.join(__dirname, 'mails/email_resetpassword.html'));
});

// app.use( '/products', productsRoutes);
// app.use( '/users' ,usersRoutes);

export default app
