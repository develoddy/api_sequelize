
import { Op, Sequelize } from 'sequelize';
import resources from "../resources/index.js";
import { Guest } from "../models/Guest.js";
import { AddressGuest } from "../models/AddressGuest.js";

// Valida si un guest existe por session_id
export const validateGuest = async (req, res) => {
    try {
        const { session_id } = req.params;
        const guest = await Guest.findOne({ where: { session_id } });
        if (guest) {
            return res.json({ exists: true });
        } else {
            return res.json({ exists: false });
        }
    } catch (error) {
        console.error('Error al validar el invitado:', error);
        res.status(500).json({ exists: false, error: 'Error interno del servidor' });
    }
};

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

export const list = async( req, res ) => {
    try {

        let guests = null;

        if ( req.query.search && req.query.search.trim() !== '' ) {

            const search = req.query.search.trim();

            guests = await Guest.findAll({
                where: {
                  [ Op.or ]: [
                    { id: { [ Op.like ]: `%${search}%` } },
                    { session_id: { [ Op.like ]: `%${search}%` } },
                    { name: { [ Op.like ]: `%${search}%` } },
                    { email: { [ Op.like ]: `%${search}%` } }
                  ]
                },
                order: [ [ 'createdAt', 'DESC' ] ]
            });

        } else {
            // Manejar el caso cuando search no tiene datos
            // Por ejemplo, devolver todos los usuarios sin filtrar
            guests = await Guest.findAll({ order: [['createdAt', 'DESC']] });
        }

        guests = guests.map( ( guest ) => {
            return resources.Guest.guest_list( guest );
        });

        res.status(200).json({
            guests: guests
        });

    } catch ( error ) {
        res.status(500).send({
            message: "debbug: GuestsController login - OCURRIÓ UN PROBLEMA"
        });
        console.log(error);
    }
}


export const remove = async( req, res ) => {
    try {

        const deletedUser = await Guest.destroy({
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

    try {
        // Paso 1: Eliminar todas las direcciones de la tabla AddressGuest
        const deletedAddresses = await AddressGuest.destroy({
            where: {} // Borra todos los registros sin filtrar por guest_id
        });

        // Paso 2: Eliminar todos los registros de la tabla Guest
        const deletedGuests = await Guest.destroy({
            where: {} // Borra todos los registros de la tabla Guest
        });

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

export const detail_guest = async( req, res ) => {
  try {

    const { email, id } = req.body;

    if (!email && !id) {
      return res.status(400).json({ status: 400, message: 'Debe enviar email o id' });
    }

    const whereClause = email ? { email } : { id };

    const guest = await Guest.findOne({
      where: whereClause,
    });

    if ( guest ) {
      res.status(200).json({
          status: 200,
          guest: guest
      });
    }

  } catch (error) {
    res.status(500).send({
      message: error
    })
  } finally {

  }
}
