import { Router } from "express";
import fs from 'fs';
import auth from '../middlewares/auth.js';
import multer from 'multer';

import { 
    register,
    update,
    list,
    remove,
    getImage,
} from "../controllers/categories.controller.js";

// Configurar el almacenamiento de archivos con Multer
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = './src/uploads/categorie';
        fs.mkdirSync(uploadDir, { recursive: true }); // Crear directorio si no existe
        cb(null, uploadDir);// Directorio donde se guardarán los archivos
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname); // Nombre del archivo
    }
  });
const upload = multer({ storage: storage });

const router = Router();

router.post( '/register', [auth.verifyAdmin, upload.array('portada')], register);
//router.put( '/update', [ auth.verifyAdmin, upload.array('portada') ], update);
router.put('/update',[auth.verifyAdmin, upload.fields([{ name: 'portada', maxCount: 1 },{ name: 'custom_image', maxCount: 1 }])],update);
router.get( '/list', auth.verifyAdmin, list);
router.delete( '/delete', auth.verifyAdmin, remove);
router.get( '/uploads/categorie/:img', getImage);

export default router;