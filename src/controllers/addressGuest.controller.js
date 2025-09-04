import { Op } from 'sequelize';
import { AddressGuest } from "../models/AddressGuest.js";
import { Guest } from "../models/Guest.js";


export const register = async (req, res) => {
    try {

        const { guest: guest_id, usual_shipping_address, email, ...addressData } = req.body;

        const guest = await Guest.findByPk(req.body.guest);

        if ( !guest ) {
            return res.status(404).json({message: "Guest no encontrado"});
        }

        // ACTUALIZAR EL EMAIL DEL GUEST SI SE PROPORCIONA
        if ( email && !guest.email ) {
            await guest.update({ email });
        }

        // Si la nueva dirección es marcada como habitual, actualiza las anteriores a false
        if ( usual_shipping_address === true ) {
            await AddressGuest.update(
                { usual_shipping_address: false },
                { where: { guest_id, usual_shipping_address: true } }
            );
        }

        // Si la nueva dirección es marcada como habitual, actualiza las anteriores a false
        const addressGuest = await AddressGuest.create({ 
            ...addressData, 
            email,
            usual_shipping_address: usual_shipping_address || false,
            guest_id ,
        });

        res.status(200).json({
            status: 200,
            message: "La dirección de envío ha sido registrado con éxito",
            address_client: addressGuest,
        });
    } catch (error) {
        res.status(500).send({
            message: "Debug: AddressClientController register ocurrió un problema",
        });

    }
}

export const list = async (req, res) => {
    try {
        const addresses = await AddressGuest.findAll();
        res.status(200).json({ status: 200, addresses });
    } catch (error) {
        console.error("Error al listar direcciones de invitados:", error);
        res.status(500).json({ message: "Error al obtener direcciones de invitados." });
    }
}

export const remove = async (req, res) => {
    try {

        const id = req.params.id;

        const deletedRows = await AddressGuest.destroy({ where: { id } });

        if (!deletedRows) {
            return res.status(404).json({ message: "Dirección no encontrada." });
        }

        res.status(200).json({ message: "Dirección eliminada con éxito." });
    } catch (error) {
        console.error("Error al eliminar dirección de invitado:", error);
        res.status(500).json({ message: "Error al eliminar dirección." });
    }
}

export const update = async (req, res) => {
    try {

        let data = req.body;
        const id = req.body._id;

        // Actualizar el registro
        const [updatedRows] = await AddressGuest.update(data, { where: { id } });

        if (!updatedRows) {
            return res.status(404).json({ 
                status: 400,
                message: "Dirección no encontrada o sin cambios" 
            });
        }

        // Recuperar el registro actualizado
        const updatedAddressGuest = await AddressGuest.findByPk(id);

        res.status(200).json({
            status: 200,
            message: "Dirección actualizada con éxito",
            address_client: updatedAddressGuest,
        });
    } catch (error) {
        res.status(500).send({
            status: 500,
            message: "¡Oops! No se pudo actualizar la dirección"
        });
        console.log(error);
    }
}

export const listone = async (req, res) => {
    try {
        const { guest_id } = req.query;

        if (!guest_id) {
          return res.status(400).json({ message: "El parámetro guest_id es requerido" });
        }

        const guestIdNumber = Number(guest_id);

        if (isNaN(guestIdNumber)) {
          return res.status(400).json({ message: "guest_id debe ser un número válido." });
        }

        const addresses = await AddressGuest.findAll({
          where: { guest_id: guestIdNumber }
        });

        res.status(200).json({ status: 200, addresses });
    } catch (error) {
        console.error("Error al obtener dirección de invitado:", error);
        res.status(500).json({ message: "Error al obtener dirección." });
    }
}

export const removeAll = async (req, res) => {
    try {
        const { guest_id } = req.params;

        // Eliminar todas las direcciones asociadas al guest_id
        const deletedRows = await AddressGuest.destroy({ where: { guest_id } });

        if (!deletedRows) {
            return res.status(404).json({ message: "No se encontraron direcciones para eliminar." });
        }

        res.status(200).json({ message: "Todas las direcciones del invitado fueron eliminadas." });
    } catch (error) {
        console.error("Error al eliminar direcciones de invitado:", error);
        res.status(500).json({ message: "Error al eliminar direcciones de invitado." });
    }
};
