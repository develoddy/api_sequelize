import token from '../services/token.js';

export default {
    verifyEcommerce: async(req, res, next) => {
        if ( !req.headers.token ) {
            return res.status(401).send({message: 'No has enviado el token'});
        }

        const response = await token.decode( req.headers.token );

        if (!response) {
            return res.status(401).json({ message: "El token no es válido" });
        }

        if (response.error === "TokenExpired") {
            return res.status(401).json({ message: "El token ha expirado" });
        }

        if (response.rol === "cliente" || response.rol === "admin") {
            // ✅ Agregar el usuario decodificado al request para que esté disponible en los controllers
            req.user = response;
            next();
        } else {
            return res.status(403).json({ message: "Acceso denegado" });
        }
    },
    verifyAdmin: async(req, res, next) => {
        try {
            console.log('🔍 [verifyAdmin] Headers received:', req.headers.token ? 'Token present' : 'No token');
            
            if ( !req.headers.token ) {
                console.log('❌ [verifyAdmin] No token provided');
                return res.status(401).send({
                    message: 'No has enviado el token'
                });
            }
            
            const response = await token.decode( req.headers.token );
            console.log('🔍 [verifyAdmin] Token decode result:', response);
            
            if ( response ) {
                console.log('🔍 [verifyAdmin] User rol:', response.rol);
                if ( response.rol == "admin" ) {
                    console.log('✅ [verifyAdmin] Admin access granted');
                    req.user = response; // Inyectar usuario en request
                    return next();
                } else {
                    console.log('❌ [verifyAdmin] Access denied - not admin rol');
                    return res.status( 403 ).send({
                        message: 'No tienes permisos de administrador para acceder a esta ruta'
                    });
                }
            } else {
                console.log('❌ [verifyAdmin] Token decode failed');
                return res.status( 401 ).send({
                    message: 'El token no es válido'
                });
            }
        } catch (error) {
            console.error('❌ Error en verifyAdmin middleware:', error);
            return res.status(500).send({
                message: 'Error al verificar autenticación'
            });
        }
    },
    optionalAuth: async (req, res, next) => {
        const rawToken = req.headers.token;

        if (!rawToken) return next();

        const response = await token.decode(rawToken);

        if (!response || response.error === "TokenExpired") return next();

        if (response.rol === "cliente" || response.rol === "admin") {
            req.user = response; // inyectamos user decodificado
        }

        next();
    },

    // 🚨 Middleware específico para Database Management (Super Admin)
    verifySuperAdmin: async(req, res, next) => {
        try {
            console.log('🔍 [verifySuperAdmin] Database Management access attempt');
            
            if ( !req.headers.token ) {
                console.log('❌ [verifySuperAdmin] No token provided');
                return res.status(401).send({
                    message: 'No has enviado el token de autenticación'
                });
            }
            
            const response = await token.decode( req.headers.token );
            console.log('🔍 [verifySuperAdmin] Token decode result:', response);
            
            if ( response ) {
                console.log('🔍 [verifySuperAdmin] User rol:', response.rol);
                
                // Permitir tanto 'admin' como 'super_admin'
                if ( response.rol === "admin" || response.rol === "super_admin" ) {
                    console.log('✅ [verifySuperAdmin] Super Admin access granted');
                    req.user = response;
                    return next();
                } else {
                    console.log('❌ [verifySuperAdmin] Access denied - insufficient privileges');
                    return res.status( 403 ).send({
                        message: 'Solo los super administradores pueden acceder a la gestión de base de datos'
                    });
                }
            } else {
                console.log('❌ [verifySuperAdmin] Token decode failed');
                return res.status( 401 ).send({
                    message: 'El token de autenticación no es válido'
                });
            }
        } catch (error) {
            console.error('❌ Error en verifySuperAdmin middleware:', error);
            return res.status(500).send({
                message: 'Error al verificar autenticación de super administrador'
            });
        }
    }
};