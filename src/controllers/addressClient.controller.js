import { Op } from 'sequelize';
import { AddressClient } from "../models/AddressClient.js";
import { User } from "../models/User.js";

const getAuthenticatedUserId = (req) => {
    const userId = Number(req.user?.id);
    return Number.isFinite(userId) && userId > 0 ? userId : null;
};

const getOwnedAddressById = async (addressId, userId) => {
    return await AddressClient.findOne({
        where: {
            id: addressId,
            userId,
        }
    });
};

const getSanitizedAddressPayload = (body = {}) => {
    const {
        _id,
        id,
        user,
        userId,
        idUser,
        ...addressData
    } = body;

    return addressData;
};


export const register = async (req, res) => {

    try {
        const authenticatedUserId = getAuthenticatedUserId(req);
        const bodyUserId = req.body.user ?? req.body.userId ?? req.body.idUser ?? null;
        const { usual_shipping_address, ...addressData } = getSanitizedAddressPayload(req.body);

        console.log('[AddressClient.register] Incoming request', {
            reqUserId: authenticatedUserId,
            bodyUserId,
            usualShippingAddress: usual_shipping_address === true
        });

        if (!authenticatedUserId) {
            return res.status(401).json({ message: "Usuario autenticado inválido" });
        }

        const user = await User.findByPk(authenticatedUserId);
        if (!user) {
            return res.status(404).json({message: "Usuario no encontrado"});
        }

        // Si la nueva dirección es marcada como habitual, actualiza las anteriores a false
        if (usual_shipping_address === true) {
            await AddressClient.update(
                { usual_shipping_address: false },
                { where: { userId: authenticatedUserId, usual_shipping_address: true } }
            );
        }

        const addressClient = await AddressClient.create({ 
            ...addressData, 
            usual_shipping_address: usual_shipping_address || false,
            userId: authenticatedUserId,
        });

        console.log('[AddressClient.register] Address created', {
            reqUserId: authenticatedUserId,
            bodyUserId,
            addressId: addressClient.id,
            ownership: 'created-for-authenticated-user'
        });
        

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
        const authenticatedUserId = getAuthenticatedUserId(req);
        const bodyUserId = req.body?.user ?? req.body?.userId ?? req.body?.idUser ?? null;
        const queryUserId = req.query.user_id ?? req.query.userId ?? req.query.idUser ?? null;

        console.log('[AddressClient.list] Incoming request', {
            reqUserId: authenticatedUserId,
            bodyUserId,
            queryUserId
        });

        if (!authenticatedUserId) {
            return res.status(401).json({ message: "Usuario autenticado inválido" });
        }

        const addressClients = await AddressClient.findAll({
            where: { userId: authenticatedUserId },
            order: [['createdAt', 'DESC']], // Ordena por fecha de creación descendente
        });

        console.log('[AddressClient.list] Ownership result', {
            reqUserId: authenticatedUserId,
            returnedCount: addressClients.length,
            ownership: 'scoped-to-authenticated-user'
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
        const authenticatedUserId = getAuthenticatedUserId(req);
        const id = Number(req.params.id);

        console.log('[AddressClient.remove] Incoming request', {
            reqUserId: authenticatedUserId,
            addressId: id
        });

        if (!authenticatedUserId) {
            return res.status(401).json({ message: "Usuario autenticado inválido" });
        }

        const ownedAddress = await getOwnedAddressById(id, authenticatedUserId);

        console.log('[AddressClient.remove] Ownership result', {
            reqUserId: authenticatedUserId,
            addressId: id,
            ownership: !!ownedAddress
        });

        if (!ownedAddress) {
            return res.status(404).json({
                message: "Ups! La dirección del cliente no fue encontrada"
            });
        }

        const result = await AddressClient.destroy({
            where: { id, userId: authenticatedUserId }
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
        const authenticatedUserId = getAuthenticatedUserId(req);
        const id = Number(req.body._id ?? req.body.id);
        const bodyUserId = req.body.user ?? req.body.userId ?? req.body.idUser ?? null;
        const data = getSanitizedAddressPayload(req.body);
        const { usual_shipping_address } = data;

        console.log('[AddressClient.update] Incoming request', {
            reqUserId: authenticatedUserId,
            bodyUserId,
            addressId: id
        });

        if (!authenticatedUserId) {
            return res.status(401).json({ message: "Usuario autenticado inválido" });
        }

        const ownedAddress = await getOwnedAddressById(id, authenticatedUserId);

        console.log('[AddressClient.update] Ownership result', {
            reqUserId: authenticatedUserId,
            addressId: id,
            ownership: !!ownedAddress
        });

        if (!ownedAddress) {
            return res.status(404).json({
                status: 404,
                message: "La dirección del cliente no fue encontrada"
            });
        }

        // Si se marca esta dirección como habitual, desmarcar otras del mismo usuario
        if (usual_shipping_address === true) {
          await AddressClient.update(
            { usual_shipping_address: false },
            {
              where: {
                userId: authenticatedUserId,
                id: { [Op.ne]: id }, // Excluir esta dirección
                usual_shipping_address: true,
              },
            }
          );
        }

        // Actualizar el registro
        const [updated] = await AddressClient.update(data, {
            where: {
                id,
                userId: authenticatedUserId,
            }
        });

        if (updated) {
            // Recuperar el registro actualizado
            const updatedAddressClient = await AddressClient.findOne({
                where: {
                    id,
                    userId: authenticatedUserId,
                }
            });

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
        const authenticatedUserId = getAuthenticatedUserId(req);
        const id = Number(req.query.id);

        console.log('[AddressClient.listone] Incoming request', {
            reqUserId: authenticatedUserId,
            addressId: id
        });

        if (!authenticatedUserId) {
            return res.status(401).json({ message: "Usuario autenticado inválido" });
        }

        const addressClient = await getOwnedAddressById(id, authenticatedUserId);

        console.log('[AddressClient.listone] Ownership result', {
            reqUserId: authenticatedUserId,
            addressId: id,
            ownership: !!addressClient
        });

        if (!addressClient) {
            return res.status(404).json({
                message: "La dirección del cliente no fue encontrada"
            });
        }

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
        const authenticatedUserId = getAuthenticatedUserId(req);
        const addressId = Number(req.body.addressId);
        const bodyUserId = req.body.userId ?? req.body.user ?? req.body.idUser ?? null;

        console.log('[AddressClient.setUsual] Incoming request', {
            reqUserId: authenticatedUserId,
            bodyUserId,
            addressId
        });

        if (!authenticatedUserId) {
            return res.status(401).json({ message: 'Usuario autenticado inválido' });
        }

        if (!addressId) {
      return res.status(400).json({ message: 'Faltan parámetros' });
    }

        const ownedAddress = await getOwnedAddressById(addressId, authenticatedUserId);

        console.log('[AddressClient.setUsual] Ownership result', {
            reqUserId: authenticatedUserId,
            addressId,
            ownership: !!ownedAddress
        });

        if (!ownedAddress) {
            return res.status(404).json({ message: 'La dirección del cliente no fue encontrada' });
        }

    // 1) Poner todas las direcciones del usuario como NO habituales
    await AddressClient.update(
      { usual_shipping_address: false },
            { where: { userId: authenticatedUserId } }
    );

    // 2) Poner la seleccionada como habitual
        const [updatedRows] = await AddressClient.update(
      { usual_shipping_address: true },
            { where: { id: addressId, userId: authenticatedUserId } }
    );

        if (!updatedRows) {
            return res.status(404).json({ message: 'La dirección del cliente no fue encontrada' });
        }

        const updated = await getOwnedAddressById(addressId, authenticatedUserId);

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
