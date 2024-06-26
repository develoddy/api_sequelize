import express from "express";
import cors from "cors";
import path from "path";
// import productsRoutes from './routes/products.routes.js';
// import usersRoutes from './routes/users.routes.js';

import { fileURLToPath } from 'url';

import router from './routes/index.js';

const app = express();
app.use(cors());

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
app.use(express.json());
app.use(express.static(path.join(__dirname,'public')));
app.use('/api/', router);

// app.use( '/products', productsRoutes);
// app.use( '/users' ,usersRoutes);

export default app