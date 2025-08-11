import express from "express";
import cors from "cors";
import path from "path";
// import productsRoutes from './routes/products.routes.js';
// import usersRoutes from './routes/users.routes.js';

import { fileURLToPath } from 'url';

import router from './routes/index.js';

const app = express();
app.use(cors());

// Límite para el tamaño de las solicitudes
app.use(express.json({ limit: '30mb' }));
app.use(express.urlencoded({ extended: true, limit: '30mb' }));

// Obtener __dirname en módulos ES
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware para desactivar caché
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
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
