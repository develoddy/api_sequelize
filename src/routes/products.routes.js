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
    register_imagen,
    remove_imagen,
    show,
    show_admin_product,
    syncPrintfulProducts,
    syncGelatoProducts,
} from "../controllers/products.controller.js";


import { 
    variedad_register,
    variedad_update,
    variedad_remove,
} from "../controllers/variedades.controller.js";


// Configurar el almacenamiento de archivos con Multer
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = './src/uploads/product';
        fs.mkdirSync(uploadDir, { recursive: true }); // Crear directorio si no existe
        cb(null, uploadDir);// Directorio donde se guardarán los archivos
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname); // Nombre del archivo
    }
  });
const upload = multer({ storage: storage });


const router = Router();

router.post("/register", [auth.verifyAdmin, upload.array('imagen')], register);
router.post("/register_imagen", [auth.verifyAdmin, upload.array('imagen')], register_imagen);
router.post("/remove_imagen", [auth.verifyAdmin, upload.array('imagen')], remove_imagen);
router.put("/update", [auth.verifyAdmin, upload.array('imagen')], update);
router.get("/list", auth.verifyAdmin, list);
router.delete("/delete", auth.verifyAdmin, remove);
router.get("/uploads/product/:img", getImage);
router.get("/show/:id", show);
router.get("/show_admin/:id", auth.verifyAdmin, show_admin_product);
router.get("/synPrintfulProducts", auth.verifyAdmin, syncPrintfulProducts);
router.get("/synGelatoProducts", auth.verifyAdmin, syncGelatoProducts);


// Variedad
router.post("/register-variedad", [auth.verifyAdmin ], variedad_register);
router.put("/update-variedad", [auth.verifyAdmin], variedad_update);
router.delete("/delete-variedad/:id", auth.verifyAdmin, variedad_remove);

export default router;