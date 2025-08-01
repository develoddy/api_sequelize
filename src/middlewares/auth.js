import token from '../services/token.js';

export default {
    verifyEcommerce: async(req, res, next) => {
        if ( !req.headers.token ) {
            res.status(401).send({message: 'No has enviado el token'});
        }

        const response = await token.decode( req.headers.token );

        if (!response) {
            return res.status(401).json({ message: "El token no es válido" });
        }

        if (response.error === "TokenExpired") {
            return res.status(401).json({ message: "El token ha expirado" });
        }

        if (response.rol === "cliente" || response.rol === "admin") {
            next();
        } else {
            return res.status(403).json({ message: "Acceso denegado" });
        }
    },
    verifyAdmin: async(req, res, next) => {
        try {
            if ( !req.headers.token ) {
                res.status(401).send({
                    message: 'No has enviado el token'
                });
            }
            const response = await token.decode( req.headers.token );
            if ( response ) {
                if ( response.rol == "admin" ) {
                    next();
                } else {
                    res.status( 401 ).send({
                        message: 'No esta permitido visitar esta ruta porque eres un cliente'
                    });
                }
            } else {
                res.status( 401 ).send({
                    message: 'El token no es validooo'
                });
            }
        } catch (error) {
            console.log(error);
        }
    },
    optionalAuth: async (req, res, next) => {
        const rawToken = req.headers.token;

        console.log("🔍 Token recibido en backend:", rawToken);

        if (!rawToken) return next();

        const response = await token.decode(rawToken);

        if (!response || response.error === "TokenExpired") return next();

        if (response.rol === "cliente" || response.rol === "admin") {
            req.user = response; // inyectamos user decodificado
        }

        next();
    },
}


