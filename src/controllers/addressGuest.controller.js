import { Op } from 'sequelize';
import { AddressGuest } from "../models/AddressGuest.js";
import { User } from "../models/User.js";


export const register = async (req, res) => {
    try {
        // Extraer los datos de la dirección del body
        const { name, surname, pais, address, zipcode, poblacion, ciudad, email, phone, referencia, nota, birthday } = req.body;

        // Crear la dirección en la base de datos
        const newGuestAddress = await AddressGuest.create({
            name,
            surname,
            pais,
            address,
            zipcode,
            poblacion,
            ciudad,
            email,
            phone,
            referencia,
            nota,
            birthday
        });

        res.status(201).json({
            status: 201,
            message: "La dirección del invitado ha sido registrada con éxito.",
            address_guest: newGuestAddress,
        });

    } catch (error) {

        console.error("Error en registrar la dirección del invitado:", error);
        res.status(500).json({
            message: "Ocurrió un problema al registrar la dirección del invitado.",
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
        //const [updated] = await AddressClient.update(data, {where: { id: id }});
        const [updatedRows] = await AddressGuest.update(data, { where: { id } });

        if (!updatedRows) {
            return res.status(404).json({ message: "Dirección no encontrada o sin cambios." });
        }

        res.status(200).json({ message: "Dirección actualizada con éxito." });
    } catch (error) {
        res.status(500).send({
            message: "debbug: AddressClienteController update OCURRIÓ UN PROBLEMA"
        });
        console.log(error);
    }
}

export const listone = async (req, res) => {
    try {
        const { id } = req.query;
        const address = await AddressGuest.findByPk(id);

        if (!address) {
            return res.status(404).json({ message: "Dirección no encontrada." });
        }

        res.status(200).json({ status: 200, address });
    } catch (error) {
        console.error("Error al obtener dirección de invitado:", error);
        res.status(500).json({ message: "Error al obtener dirección." });
    }
}
