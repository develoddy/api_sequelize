import { Op } from 'sequelize';
import { AddressClient } from "../models/AddressClient.js";
import { User } from "../models/User.js";


export const register = async (req, res) => {
    console.log('🔥 [Backend] register() called');
    console.log('🔥 [Backend] Request body:', req.body);
    console.log('🔥 [Backend] Request timestamp:', new Date().toISOString());
    
    try {
        // Verifica si el usuario existe antes de crear la dirección
        const { user: userId, usual_shipping_address, ...addressData } = req.body;

        const user = await User.findByPk(req.body.user);
        if (!user) {
            return res.status(404).json({message: "Usuario no encontrado"});
        }

        // Si la nueva dirección es marcada como habitual, actualiza las anteriores a false
        if (usual_shipping_address === true) {
            await AddressClient.update(
                { usual_shipping_address: false },
                { where: { userId, usual_shipping_address: true } }
            );
        }

        // Si la nueva dirección es marcada como habitual, actualiza las anteriores a false
        console.log('💾 [Backend] About to create address in database');
        const addressClient = await AddressClient.create({ 
            ...addressData, 
            usual_shipping_address: usual_shipping_address || false,
            userId ,
        });
        console.log('✅ [Backend] Address created successfully with ID:', addressClient.id);

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
        const { usual_shipping_address, user } = data;

        // Si se marca esta dirección como habitual, desmarcar otras del mismo usuario
        if (usual_shipping_address === true) {
          await AddressClient.update(
            { usual_shipping_address: false },
            {
              where: {
                userId: user,
                id: { [Op.ne]: id }, // Excluir esta dirección
                usual_shipping_address: true,
              },
            }
          );
        }

        // Actualizar el registro
        const [updated] = await AddressClient.update(data, {where: { id: id }});

        if (updated) {
            // Recuperar el registro actualizado
            const updatedAddressClient = await AddressClient.findByPk(id);

            res.status(200).json({
                status: 200,
                message: "Dirección actualizada con éxito",
                address_client: updatedAddressClient,
            });
        } else {
            res.status(404).json({
                status: 400,
                message: "La dirección del cliente no fue encontrada"
            });
        }
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

        const id = req.query.id;

        // Busca las direcciones del cliente del usuario especificado
        const addressClient = await AddressClient.findOne({
            where: { id: id },
            order: [['createdAt', 'DESC']], // Ordena por fecha de creación descendente
        });

        res.status(200).json({
            address_client: addressClient, // Ajusta el nombre de la propiedad según sea necesario
        });
    } catch (error) {
        res.status(500).send({
            message: "Debug: AddressClienteController list ocurrió un problema",
        });
        console.log(error);
    }
}

export const setAsUserAuthenticatedUsualShippingAddress = async (req, res) => {
  try {
    const { addressId, userId } = req.body;

    if (!addressId || !userId) {
      return res.status(400).json({ message: 'Faltan parámetros' });
    }

    // 1) Poner todas las direcciones del usuario como NO habituales
    await AddressClient.update(
      { usual_shipping_address: false },
      { where: { userId } }
    );

    // 2) Poner la seleccionada como habitual
    await AddressClient.update(
      { usual_shipping_address: true },
      { where: { id: addressId } }
    );

    const updated = await AddressClient.findByPk(addressId);

    res.status(200).json({
        status: 200,
        message: "Dirección habitual actualizada",
        address_client: updated,
    });
  } catch (error) {
    console.error("Error al actualizar dirección habitual:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};
