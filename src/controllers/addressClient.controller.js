import { Op } from 'sequelize';
import { AddressClient } from "../models/AddressClient.js";
import { User } from "../models/User.js";


export const register = async (req, res) => {
    try {
        // Verifica si el usuario existe antes de crear la dirección
        const { user: userId, ...addressData } = req.body;

        const user = await User.findByPk(req.body.user);
        if (!user) {
            return res.status(404).json({
                message: "Usuario no encontrado",
            });
        }

        // Crea la dirección del cliente
        //const addressClient = await AddressClient.create(req.body);
        const addressClient = await AddressClient.create({ ...addressData, userId });

        res.status(200).json({
            status: 200,
            message: "La dirección de envío ha sido registrado con éxito.",
            address_client: addressClient,
        });
    } catch (error) {

        console.log("Error en registrar la direccion:", error);
        res.status(500).send({
            message: "Debug: AddressClientController register ocurrió un problema",
        });

    }
}

export const list = async (req, res) => {
    try {
        const userId = req.query.user_id;

        // Busca las direcciones del cliente del usuario especificado
        const addressClients = await AddressClient.findAll({
            where: { userId: userId },
            order: [['createdAt', 'DESC']], // Ordena por fecha de creación descendente
        });

        res.status(200).json({
            address_client: addressClients, // Ajusta el nombre de la propiedad según sea necesario
        });
    } catch (error) {
        res.status(500).send({
            message: "Debug: AddressClienteController list ocurrió un problema",
        });
        console.log(error);
    }
}

export const remove = async (req, res) => {
    try {

        const id = req.params.id;

        const result = await AddressClient.destroy({
            where: { id: id }
        });

        if ( result ) {
            res.status(200).json({
                message: "Success! La dirección del cliente se borró correctamente"
            });
        } else {
            res.status(404).json({
                message: "Ups! La dirección del cliente no fue encontrada"
            });
        }
    } catch (error) {
        res.status(500).send({
            message: error,//"debbug: AddressClienteController delete OCURRIÓ UN PROBLEMA"
        });
        console.log(error);
    }
}

export const update = async (req, res) => {
    try {

        let data = req.body;
        const id = req.body._id;

        // Actualizar el registro
        const [updated] = await AddressClient.update(data, {
            where: { id: id }
        });

        if (updated) {
            // Recuperar el registro actualizado
            const updatedAddressClient = await AddressClient.findByPk(id);

            res.status(200).json({
                status: 200,
                message: "La dirección de envío ha sido modificado con éxito.",
                address_client: updatedAddressClient,
            });
        } else {
            res.status(404).json({
                message: "La dirección del cliente no fue encontrada"
            });
        }
    } catch (error) {
        res.status(500).send({
            message: "debbug: AddressClienteController update OCURRIÓ UN PROBLEMA"
        });
        console.log(error);
    }
}
