import { Op } from 'sequelize';
import resources from "../resources/index.js";
import { User } from "../models/User.js";
import token from "../services/token.js";
import bcrypt from 'bcryptjs';
import { getPrintfulProducts } from './proveedor/printful/productPrintful.controller.js';

export const register_admin = async( req, res ) => {
    try {
        const userV = await User.findOne({ 
            where: {
                email: req.body.email
            }
        });

        if ( userV ) {
            res.status( 500 ).send({
                message: "El usuario que intentas registrar ya exsite"
            });
        }

        req.body.rol = "admin";
        req.body.password = await bcrypt.hash( req.body.password, 10 );
        let user = await User.create( req.body );

        res.status(200).json({
            user: resources.User.user_list( user )
        });

    } catch ( error ) {
        res.status( 500 ).send({
            message: "debbug: UserController register_admin - OCURRIÓ UN PROBLEMA"
        });
        console.log(error);
    }
}

export const register = async ( req, res ) => {
    try {
        req.body.password = await bcrypt.hash( req.body.password, 10 );
        const user = await User.create( req.body );
        res.status( 200 ).json( user );
        res.send(
            'register user:' + req.body.password 
        );
    } catch ( error ) {
        res.status(500).send({
            message: "debbug: UserController register - OCURRIÓ UN PROBLEMA"
        });
        console.log(error);
    }
}

export const login = async( req, res ) => {
    try {
        //const user = await User.findOne({email: req.body.email, state:1});
        const user = await User.findOne({ 
            where: {
                email: req.body.email, 
                state: 1
            }
        });

        if (user) {
            // SI ESTÁ REGISTRADO EN EL SISTEMA
            let compare = await bcrypt.compare(req.body.password, user.password);
            if (compare) {
                let tokenT = await token.encode(user.id, user.rol, user.email);
                const USER_FRONTED = {
                    token: tokenT,
                    user: {
                        _id: user.id,
                        name: user.name,
                        email: user.email,
                        surname: user.surname,
                        avatar: user.avatar
                    }
                }
                res.status(200).json({
                    USER_FRONTED:USER_FRONTED
                });
            } else {
                res.status(500).send({
                    message: "El correo electrónico o la contraseña que has introducido es incorrecta."
                });
            }
        } else {
            res.status(500).send({
                message: "El correo electrónico o la contraseña que has introducido es incorrecta."
            });
        }
    } catch (error) {
        res.status(500).send({
            message: "debbug: UserController login - OCURRIÓ UN PROBLEMA"
        });
        console.log(error);
    }
}

export const login_admin = async( req, res ) => {
    try {
        const user = await User.findOne({ 
            where: {
                email: req.body.email, 
                state: 1, 
                rol: "admin"
            }
        });

        if ( user ) {
            // SI ESTÁ REGISTRADO EN EL SISTEMA
            let compare = await bcrypt.compare(req.body.password, user.password);
            if (compare) {
                let tokenT = await token.encode(user.id, user.rol, user.email);
                const USER_FRONTED = {
                    token: tokenT,
                    user: {
                        name: user.name,
                        email: user.email,
                        surname: user.surname,
                        avatar: user.avatar,
                        rol: user.rol,
                    }
                }
                await getPrintfulProducts();
                res.status(200).json({
                    USER_FRONTED:USER_FRONTED
                });
            } else {
                res.status(500).send({
                    message: "¡Ups! El usuario o contraseña son incorrectos"
                });
            }
        } else {
            res.status(500).send({
                message: "¡Ups! El usuario o contraseña son incorrectos"
            });
        }
    } catch (error) {
        res.status(500).send({
            message: "debbug: UserController login - OCURRIÓ UN PROBLEMA"
        });
        console.log(error);
    }
}

export const update = async(req, res) => {
    try {
        if ( req.files ) {
            var img_path = req.files.avatar.path;
            var name = img_path.split('\\');
            var avatar_name = name[2];
            console.log(avatar_name);
        }
        
        if ( req.body.password ) {
            req.body.password = await bcrypt.hash( req.body.password, 10 );
        }

        await User.update(req.body, { where: { id: req.body.id } });
        const UserT = await User.findOne({ where: { id: req.body.id } });

        res.status(200).json({
            message: "El usuario se ha modificado correctamente",
            user: resources.User.user_list( UserT ),
        });
    } catch ( error ) {
        res.status( 500 ).send({
            message: "debbug: UserController login - OCURRIÓ UN PROBLEMA"
        });
        console.log(error);
    }
}

export const list = async( req, res ) => {
    try {

        let users = null;

        if ( req.query.search && req.query.search.trim() !== '' ) {

            const search = req.query.search.trim();

            users = await User.findAll({
                where: {
                  [ Op.or ]: [
                    { name: { [ Op.like ]: `%${search}%` } },
                    { surname: { [ Op.like ]: `%${search}%` } },
                    { email: { [ Op.like ]: `%${search}%` } }
                  ]
                },
                order: [ [ 'createdAt', 'DESC' ] ]
            });

        } else {
            // Manejar el caso cuando search no tiene datos
            // Por ejemplo, devolver todos los usuarios sin filtrar
            users = await User.findAll({ order: [['createdAt', 'DESC']] });
        }

        users = users.map( ( user ) => {
            return resources.User.user_list( user );
        });

        res.status(200).json({
            users: users
        });

    } catch ( error ) {
        res.status(500).send({
            message: "debbug: UserController login - OCURRIÓ UN PROBLEMA"
        });
        console.log(error);
    }
}

export const remove = async( req, res ) => {
    try {

        const deletedUser = await User.destroy({ 
            where: { 
                id: req.query._id 
            }
         });

        if ( deletedUser == 1 ) {
            res.status( 200 ).json({
                message: "¡Success! El usuario se borro correctamente"
            });
        } else {
            res.status( 404 ).json({
                message: "¡Ups! El usuario que intenta borrar, no existe"
            });
        }

    } catch ( error ) {
        res.status(500).send({
            message: "debbug: UserController remove - OCURRIÓ UN PROBLEMA"
        });
        console.log(error);
    }
}