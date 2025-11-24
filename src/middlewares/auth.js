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
            if ( !req.headers.token ) {
                return res.status(401).send({
                    message: 'No has enviado el token'
                });
            }
            const response = await token.decode( req.headers.token );
            if ( response ) {
                if ( response.rol == "admin" ) {
                    req.user = response; // Inyectar usuario en request
                    return next();
                } else {
                    return res.status( 403 ).send({
                        message: 'No tienes permisos de administrador para acceder a esta ruta'
                    });
                }
            } else {
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
}


