import token from '../services/token.js';

export default {
    verifyEcommerce: async(req, res, next) => {
        if ( !req.headers.token ) {
            res.status(401).send({
                message: 'No has enviado el token'
            });
        }
        const response = await token.decode( req.headers.token );
        if ( response ) {
            if ( response.rol == "cliente" || response.rol == "admin" ) {
                next();
            } else {
                res.status( 401 ).send({
                    message: 'No esta permitido visitar esta ruta'
                });
            }
        } else {
            res.status( 401 ).send({
                message: 'El token no es valido'
            });
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
}