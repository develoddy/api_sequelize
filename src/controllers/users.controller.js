import { Op, Sequelize } from 'sequelize';
import resources from "../resources/index.js";
import { User } from "../models/User.js";
import { AddressClient } from "../models/AddressClient.js";
import token from "../services/token.js";
import bcrypt from 'bcryptjs';
import { getPrintfulProducts } from './proveedor/printful/productPrintful.controller.js';
import jwt from "jsonwebtoken";
import nodemailer from 'nodemailer';
import fs from 'fs';
import path from "path";
import handlebars from 'handlebars';
import ejs from 'ejs';
import smtpTransport from 'nodemailer-smtp-transport';
import dotenv from 'dotenv';
dotenv.config(); // Cargar las variables de entorno

import { verifyRecaptcha } from '../devtools/utils/verifyRecaptcha.js';

// ------ Send Email -----
// Función para leer un archivo HTML
const readHTMLFile = (path) => {
    return new Promise((resolve, reject) => {
        fs.readFile(path, { encoding: 'utf-8' }, (err, html) => {
            if (err) {
                return reject(err);
            }
            resolve(html);
        });
    });
};

const { EMAIL_USER, EMAIL_PASS, JWT_SECRET } = process.env;

// Función para enviar el correo de restablecimiento de contraseña
async function sendEmailResetPassword(email, token) {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: EMAIL_USER,
            pass: EMAIL_PASS,
        },
    });

    const link = `${process.env.URL_FRONTEND}/auth/updatepassword/${token}/${email}`;

    // Leer el template HTML
    const htmlTemplate = await readHTMLFile(`${process.cwd()}/src/mails/email_resetpassword.html`);

    // Renderizar el HTML con el enlace de restablecimiento
    const renderedHTML = ejs.render(htmlTemplate, { 
        resetLink: link,
        token: token,
        email: email
    });

    const mailOptions = {
        from: EMAIL_USER,
        to: email,
        subject: 'Restablece tu contraseña',
        html: renderedHTML
    };

    await transporter.sendMail(mailOptions);
}

// Endpoint para solicitar el restablecimiento de contraseña
export const requestPasswordReset = async (req, res) => {

    const { email } = req.body;

    // Aquí debes buscar el usuario por su correo electrónico
    const user = await User.findOne({
            where: {
                email: email,
                state: 1
            }
        });

    if (!user) {
        return res.status(404).send({ message: 'Usuario no encontrado' });
    }

    // Comprobar si JWT_SECRET tiene un valor
    if (!JWT_SECRET) {
        return res.status(500).send({ message: 'Error del servidor: JWT_SECRET no está configurado.' });
    }

    // Crear un token JWT
    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '1h' });

    // Enviar el correo electrónico con el enlace de restablecimiento
    try {
        await sendEmailResetPassword(email, token);
        res.status(200).send({ message: 'Correo de restablecimiento enviado' });
    } catch (error) {
        res.status(500).send({ message: 'Error al enviar el correo: '+ error });
    }
};

// Endpoint para restablecer la contraseña
export const resetPassword = async (req, res) => {
    const { token, newPassword } = req.body;

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const userId = decoded.id;

        // Verificar que newPassword no sea undefined o vacío
        if (!newPassword) {
            return res.status(400).send({ message: 'La nueva contraseña no puede estar vacía' });
        }

        // Hashear la nueva contraseña
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await User.update({ password: hashedPassword }, { where: { id: userId } }); // Cambiar a User.update para Sequelize
        res.status(200).send({ message: 'Contraseña restablecida exitosamente' });
    } catch (error) {
        console.error("---- Debbug API Error al restablecer la contraseña:", error);
        res.status(400).send({ message: 'Token inválido o ha expirado' });
    }
};

export const register_admin = async( req, res ) => {
    const { recaptchaToken } = req.body;

    // ✅ 1. Verificar reCAPTCHA
    // Solo verificar reCAPTCHA si no estamos en entorno de desarrollo
    if (process.env.NODE_ENV !== 'development') {
        const { success, score } = await verifyRecaptcha(recaptchaToken);

        if (!success || score < 0.5) {
            return res.status(403).json({
              message: 'Falló la verificación de reCAPTCHA. Intenta de nuevo.',
            });
        }
    }

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

    const { recaptchaToken } = req.body;

    // ✅ 1. Verificar reCAPTCHA
    // Solo verificar reCAPTCHA si no estamos en entorno de desarrollo
    if (process.env.NODE_ENV !== 'development') {
        const { success, score } = await verifyRecaptcha(recaptchaToken);

        if (!success || score < 0.5) {
            return res.status(403).json({
              message: 'Falló la verificación de reCAPTCHA. Intenta de nuevo.',
            });
        }
    }

    // ✅ 2. Continuar con el registro
    try {
        req.body.password = await bcrypt.hash( req.body.password, 10 );
        const user = await User.create( req.body );
        res.status(200).json({
            status: 200,
            message: "Usuario registrado correctamente.",
            data: user
        });
    } catch ( error ) {
        if (error instanceof Sequelize.UniqueConstraintError) {
            return res.status(400).send({
                message: "Este correo electrónico ya está registrado en nuestro sistema."
            });
        }
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
                // let tokenT = await token.encode(user.id, user.rol, user.email);
                let tokens = await token.encode(user.id, user.rol, user.email);
                const USER_FRONTED = {
                    //token: tokenT,
                    accessToken: tokens.accessToken,
                    refreshToken: tokens.refreshToken,
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
                    message: "Tu e-mail o contraseña no son correctos o no están registrados"
                });
            }
        } else {
            res.status(500).send({
                message: "Tu e-mail o contraseña no son correctos o no están registrados"
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
                //let tokenT = await token.encode(user.id, user.rol, user.email);
                let tokens = await token.encode(user.id, user.rol, user.email);
                const USER_FRONTED = {
                    //token: tokenT,
                    accessToken: tokens.accessToken,
                    refreshToken: tokens.refreshToken,
                    user: {
                        name: user.name,
                        email: user.email,
                        surname: user.surname,
                        avatar: user.avatar,
                        rol: user.rol,
                    }
                }

                // Sincroniza con printfull
                //await getPrintfulProducts();
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

export const refreshToken = async (req, res) => {

    const { refresh_token } = req.body;

    if (!refresh_token) {
        return res.status(401).json({ message: "No se proporcionó un refresh token" });
    }

    try {
        const decoded = await token.decode(refresh_token);

        if (!decoded || decoded.error === "TokenExpired") {
            return res.status(403).json({ message: "El refresh token ha expirado. Inicia sesión nuevamente." });
        }

        // Generar un nuevo Access Token
        const newTokens = await token.encode(decoded.id, decoded.rol, decoded.email);

        res.json({
            accessToken: newTokens.accessToken,
            refreshToken: newTokens.refreshToken
        });
    } catch (error) {
        console.error("❌ Error al refrescar el token:", error);
        res.status(500).json({ message: "Error al renovar el token" });
    }
};

export const update = async(req, res) => {
    try {
        if ( req.files ) {
            var img_path = req.files.avatar.path;
            var name = img_path.split('\\');
            var avatar_name = name[2];
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

export const detail_user = async( req, res ) => {
  try {

    const { email, id } = req.body;

    if (!email && !id) {
      return res.status(400).json({ status: 400, message: 'Debe enviar email o id' });
    }

    const whereClause = email ? { email } : { id };

    const user = await User.findOne({
      where: whereClause,
    });

    if ( user ) {
      res.status(200).json({
          status: 200,
          user: user
      });
    }

  } catch (error) {
    res.status(500).send({
      message: error
    })
  } finally {

  }
}
