import { Router } from "express";
import fs from 'fs';
import auth from '../middlewares/auth.js';
import multer from 'multer';
import { 
    register,
    list,
    update,
    getImage,
    remove,
} from "../controllers/sliders.controller.js";

// Configurar el almacenamiento de archivos con Multer
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = './src/uploads/slider';
        fs.mkdirSync(uploadDir, { recursive: true }); // Crear directorio si no existe
        cb(null, uploadDir);// Directorio donde se guardarán los archivos
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname); // Nombre del archivo
    }
  });
//const upload = multer({ storage: storage });
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5 MB por archivo
  }
});

const router = Router();

router.post("/register", [auth.verifyAdmin, upload.fields([
    { name: 'imagen_mobile', maxCount: 1 },
    { name: 'imagen_desktop', maxCount: 1 }
])], register);
router.get("/list", auth.verifyAdmin, list);
router.put("/update", [auth.verifyAdmin, upload.fields([
    { name: 'imagen_mobile', maxCount: 1 },
    { name: 'imagen_desktop', maxCount: 1 }
])], update);
router.delete("/delete", auth.verifyAdmin, remove);
router.get("/uploads/slider/:img", getImage);

export default router;