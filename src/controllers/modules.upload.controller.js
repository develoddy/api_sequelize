import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Controller: Module Image Upload
 * Maneja la subida de screenshots/imágenes para módulos
 */

// Configuración de multer para subir imágenes de módulos
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const moduleKey = req.params.moduleKey || 'temp';
    const uploadPath = path.join(__dirname, '../../public/uploads/modules', moduleKey);
    
    // Crear directorio si no existe
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    // Generar nombre único: timestamp + extensión original
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'screenshot-' + uniqueSuffix + ext);
  }
});

// Filtro para aceptar solo imágenes
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Solo se permiten imágenes (jpeg, jpg, png, gif, webp)'));
  }
};

export const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB por imagen
  },
  fileFilter: fileFilter
});

/**
 * Sube múltiples screenshots para un módulo
 */
export const uploadModuleScreenshots = async (req, res) => {
  try {
    const { moduleKey } = req.params;
    
    console.log('📸 Upload request received');
    console.log('   Module Key:', moduleKey);
    console.log('   Files count:', req.files?.length || 0);
    
    if (!req.files || req.files.length === 0) {
      console.log('❌ No files received');
      return res.status(400).json({
        ok: false,
        message: 'No se enviaron archivos'
      });
    }

    // Generar URLs públicas para las imágenes subidas
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? 'https://api.lujandev.com'
      : 'http://127.0.0.1:3500';

    const screenshotUrls = req.files.map(file => {
      const url = `${baseUrl}/uploads/modules/${moduleKey}/${file.filename}`;
      console.log('   ✅ Saved:', file.filename);
      return url;
    });

    console.log('✅ Upload completed successfully');
    
    res.status(200).json({
      ok: true,
      message: `${req.files.length} imagen(es) subida(s) correctamente`,
      screenshots: screenshotUrls,
      files: req.files.map(f => ({
        filename: f.filename,
        size: f.size,
        url: `${baseUrl}/uploads/modules/${moduleKey}/${f.filename}`
      }))
    });

  } catch (error) {
    console.error('❌ Error subiendo screenshots:', error);
    res.status(500).json({
      ok: false,
      message: 'Error al subir las imágenes',
      error: error.message
    });
  }
};

/**
 * Elimina un screenshot específico
 */
export const deleteModuleScreenshot = async (req, res) => {
  try {
    const { moduleKey, filename } = req.params;
    const filePath = path.join(__dirname, '../../public/uploads/modules', moduleKey, filename);

    // Verificar si el archivo existe
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        ok: false,
        message: 'Archivo no encontrado'
      });
    }

    // Eliminar archivo
    fs.unlinkSync(filePath);

    res.status(200).json({
      ok: true,
      message: 'Imagen eliminada correctamente'
    });

  } catch (error) {
    console.error('Error eliminando screenshot:', error);
    res.status(500).json({
      ok: false,
      message: 'Error al eliminar la imagen',
      error: error.message
    });
  }
};

/**
 * Limpia todas las imágenes de un módulo
 */
export const cleanModuleScreenshots = async (req, res) => {
  try {
    const { moduleKey } = req.params;
    const dirPath = path.join(__dirname, '../../public/uploads/modules', moduleKey);

    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
      
      res.status(200).json({
        ok: true,
        message: 'Todas las imágenes del módulo fueron eliminadas'
      });
    } else {
      res.status(404).json({
        ok: false,
        message: 'Directorio no encontrado'
      });
    }

  } catch (error) {
    console.error('Error limpiando screenshots:', error);
    res.status(500).json({
      ok: false,
      message: 'Error al limpiar las imágenes',
      error: error.message
    });
  }
};
