import { Op, Sequelize } from 'sequelize';
import resources from "../resources/index.js";
import { Guest } from "../models/Guest.js";
import { AddressGuest } from "../models/AddressGuest.js";

export const register = async (req, res) => {
    try {

        // Obtenemos los datos del cuerpo de la solicitud
        const { name, session_id } = req.body;

        // Verificamos si ya existe un invitado con el mismo session_id
        const existingGuest = await Guest.findOne({ where: { session_id } });

        if (existingGuest) {
            return res.status(400).json({
                status: 400,
                message: "Este invitado ya está registrado en la sesión"
            });
        }

        // Si no existe, registramos el nuevo invitado
        const newGuest = await Guest.create({
            session_id,
            name: name || null,  // Si no se pasa un nombre, se guarda como null
            //email: email || null, // Si no se pasa un email, se guarda como null
            //phone: phone || null, // Si no se pasa un teléfono, se guarda como null
            //zipcode: zipcode || null // Si no se pasa un código postal, se guarda como null
        });

        res.status(200).json({
            status: 200,
            message: "Invitado registrado correctamente",
            data: newGuest
        });
    } catch (error) {
        console.error('Error al registrar al invitado:', error);

        res.status(500).json({
            status: 500,
            message: "Ocurrió un problema al registrar el invitado."
        });
    }
};


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


export const removeAll = async (req, res) => {

    console.log("----> En guets.controller.js, ejecuta removeAll");
    try {
        // Paso 1: Eliminar todas las direcciones de la tabla AddressGuest
        const deletedAddresses = await AddressGuest.destroy({
            where: {} // Borra todos los registros sin filtrar por guest_id
        });

        console.log(`${deletedAddresses} direcciones eliminadas de AddressGuest.`);

        // Paso 2: Eliminar todos los registros de la tabla Guest
        const deletedGuests = await Guest.destroy({
            where: {} // Borra todos los registros de la tabla Guest
        });

        console.log(`${deletedGuests} registros eliminados de Guest.`);

        res.status(200).json({
            message: "¡Éxito! Todos los datos de los invitados y direcciones han sido eliminados correctamente."
        });

    } catch (error) {
        console.error("Error al eliminar los datos de invitado:", error);
        res.status(500).send({
            message: "Ocurrió un problema al eliminar los datos del invitado."
        });
    }
}
