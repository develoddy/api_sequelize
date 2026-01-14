import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';

/**
 * Middleware para verificar JWT de administradores
 * Protege rutas que solo deben ser accesibles por admins
 */
export const authenticateAdmin = async (req, res, next) => {
  try {
    // Obtener token del header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No autorizado. Token no proporcionado.'
      });
    }

    const token = authHeader.split(' ')[1];

    // Verificar token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Token inválido o expirado'
      });
    }

    // Buscar usuario en base de datos
    const user = await User.findByPk(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    // Verificar que sea administrador
    if (user.rol !== 'Administrador' && user.rol !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Acceso denegado. Se requieren permisos de administrador.'
      });
    }

    // Adjuntar usuario al request
    req.user = {
      id: user.id,
      email: user.email,
      rol: user.rol,
      name: user.name
    };

    next();
  } catch (error) {
    console.error('Error en authenticateAdmin:', error);
    return res.status(500).json({
      success: false,
      message: 'Error en autenticación',
      error: error.message
    });
  }
};

/**
 * Middleware opcional para logging de acciones admin
 */
export const logAdminAction = (action) => {
  return (req, res, next) => {
    console.log(`[Admin Action] ${action} by user ${req.user?.email || 'unknown'} at ${new Date().toISOString()}`);
    next();
  };
};
