import { Op } from 'sequelize';
import { AddressGuest } from "../models/AddressGuest.js";
import { Guest } from "../models/Guest.js";

const normalizeText = (value) => {
    if (value === null || value === undefined) return null;
    const trimmed = String(value).trim();
    return trimmed.length > 0 ? trimmed : null;
};

const normalizeEmail = (value) => {
    const normalized = normalizeText(value);
    return normalized ? normalized.toLowerCase() : null;
};

const resolveGuestId = (body = {}) => {
    const rawGuestId = body.guest ?? body.guest_id ?? body.guestId ?? body.user?._id ?? body.user?.id ?? body.user;
    const guestId = Number(rawGuestId);
    return Number.isFinite(guestId) && guestId > 0 ? guestId : null;
};

const resolveGuestSessionId = (body = {}) => {
    return normalizeText(body.guestSessionId ?? body.guest_session_id ?? body.session_id ?? body.user?.session_id);
};

const isValidEmail = (email) => {
    if (!email) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};


export const register = async (req, res) => {
    try {

        const { usual_shipping_address, ...payload } = req.body;
        const guest_id = resolveGuestId(req.body);

        if (!guest_id) {
            return res.status(400).json({ message: "guest_id inválido o faltante" });
        }

        const guest = await Guest.findByPk(guest_id);

        if ( !guest ) {
            return res.status(404).json({message: "Guest no encontrado"});
        }

        const name = normalizeText(payload.name);
        const email = normalizeEmail(payload.email);
        const zipcode = normalizeText(payload.zipcode);
        const phone = normalizeText(payload.phone);

        if (email && !isValidEmail(email)) {
            return res.status(400).json({ message: "Email inválido" });
        }

        // 🔧 ACTUALIZAR LOS DATOS DEL GUEST SI SE PROPORCIONAN (primer guardado)
        const updateData = {};

        if (name && guest.name !== name) {
            updateData.name = name;
        }

        if (email && guest.email !== email) {
            updateData.email = email;
        }

        if (zipcode && guest.zipcode !== zipcode) {
            updateData.zipcode = zipcode;
        }

        if (phone && guest.phone !== phone) {
            updateData.phone = phone;
        }

        if (Object.keys(updateData).length > 0) {
            await guest.update(updateData);
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
            surname: normalizeText(payload.surname) || '',
            pais: normalizeText(payload.pais) || '',
            address: normalizeText(payload.address) || '',
            email,
            name,
            zipcode,
            phone,
            poblacion: normalizeText(payload.poblacion) || '',
            ciudad: normalizeText(payload.ciudad) || '',
            referencia: normalizeText(payload.referencia),
            nota: normalizeText(payload.nota),
            usual_shipping_address: usual_shipping_address || false,
            guest_id ,
        });

        res.status(200).json({
            status: 200,
            message: "La dirección de envío ha sido registrado con éxito",
            address_client: addressGuest,
        });
    } catch (error) {
        console.error("Error al registrar dirección de envío:", error);
        res.status(500).send({
            message: "Debug: AddressClientController register ocurrió un problema",
        });

    }
}

export const list = async (req, res) => {
    try {
        const guestIdParam = req.query.guest_id ?? req.query.guestId;
        const guestId = Number(guestIdParam);

        if (!Number.isFinite(guestId) || guestId <= 0) {
            return res.status(400).json({ message: "El parámetro guest_id es requerido y debe ser válido" });
        }

        const addresses = await AddressGuest.findAll({
            where: { guest_id: guestId },
            order: [[ 'updatedAt', 'DESC' ]]
        });
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
        const id = Number(req.body._id ?? req.body.id);
        const guestIdFromPayload = resolveGuestId(req.body);
        const guestSessionId = resolveGuestSessionId(req.body);

        if (!Number.isFinite(id) || id <= 0) {
            return res.status(400).json({
                status: 400,
                message: "ID de dirección inválido"
            });
        }

        const addressGuest = await AddressGuest.findByPk(id);

        if (!addressGuest) {
            return res.status(404).json({ 
                status: 404,
                message: "Dirección no encontrada" 
            });
        }

        const effectiveGuestId = guestIdFromPayload || addressGuest.guest_id;

        if (guestIdFromPayload && Number(addressGuest.guest_id) !== Number(guestIdFromPayload)) {
            return res.status(403).json({
                status: 403,
                message: "La dirección no pertenece al guest indicado"
            });
        }

        const guest = effectiveGuestId ? await Guest.findByPk(effectiveGuestId) : null;

        if (effectiveGuestId && !guest) {
            return res.status(404).json({
                status: 404,
                message: "Guest no encontrado para la dirección"
            });
        }

        if (guestSessionId && guest && guest.session_id !== guestSessionId) {
            return res.status(403).json({
                status: 403,
                message: "Sesión de guest inválida para actualizar la dirección"
            });
        }

        const nextName = normalizeText(req.body.name);
        const nextEmail = normalizeEmail(req.body.email);
        const nextZipcode = normalizeText(req.body.zipcode);
        const nextPhone = normalizeText(req.body.phone);

        if (nextEmail && !isValidEmail(nextEmail)) {
            return res.status(400).json({
                status: 400,
                message: "Email inválido"
            });
        }

        const updateAddressData = {
            name: nextName,
            surname: normalizeText(req.body.surname),
            pais: normalizeText(req.body.pais),
            address: normalizeText(req.body.address),
            zipcode: nextZipcode,
            poblacion: normalizeText(req.body.poblacion),
            ciudad: normalizeText(req.body.ciudad),
            email: nextEmail,
            phone: nextPhone,
            referencia: normalizeText(req.body.referencia),
            nota: normalizeText(req.body.nota)
        };

        // Usual shipping: mantener una sola dirección habitual por guest.
        if (typeof req.body.usual_shipping_address === 'boolean') {
            updateAddressData.usual_shipping_address = req.body.usual_shipping_address;
            if (req.body.usual_shipping_address === true && effectiveGuestId) {
                await AddressGuest.update(
                    { usual_shipping_address: false },
                    {
                        where: {
                            guest_id: effectiveGuestId,
                            id: { [Op.ne]: id },
                            usual_shipping_address: true
                        }
                    }
                );
            }
        }

        const addressBeforeEmail = addressGuest.email;
        await addressGuest.update(updateAddressData);

        let guestRowsUpdated = 0;
        let guestBeforeEmail = null;
        let guestAfterEmail = null;

        // 🔄 Sincronización crítica: al editar address de invitado también actualizar Guest.
        if (guest) {
            guestBeforeEmail = guest.email;
            const guestUpdateData = {};

            if (nextName && guest.name !== nextName) guestUpdateData.name = nextName;
            if (nextEmail && guest.email !== nextEmail) guestUpdateData.email = nextEmail;
            if (nextZipcode && guest.zipcode !== nextZipcode) guestUpdateData.zipcode = nextZipcode;
            if (nextPhone && guest.phone !== nextPhone) guestUpdateData.phone = nextPhone;

            if (Object.keys(guestUpdateData).length > 0) {
                await guest.update(guestUpdateData);
                guestRowsUpdated = 1;
            }

            guestAfterEmail = guestUpdateData.email || guest.email;
        }

        console.log('[AddressGuest.update] Sync summary', {
            addressId: id,
            guestId: effectiveGuestId || null,
            guestSessionId: guestSessionId || null,
            addressEmailOld: addressBeforeEmail || null,
            addressEmailNew: nextEmail || addressGuest.email || null,
            guestEmailOld: guestBeforeEmail,
            guestEmailNew: guestAfterEmail,
            addressRowsUpdated: 1,
            guestRowsUpdated
        });

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

export const setGuestUsualShippingAddress = async (req, res) => {
  try {
    const { addressId, guestId } = req.body;

    if (!addressId || !guestId) {
      return res.status(400).json({ message: 'Faltan parámetros' });
    }

    // 1) Poner todas las direcciones del usuario como NO habituales
    await AddressGuest.update(
      { usual_shipping_address: false },
      { where: { guest_id: guestId } }
    );

    // 2) Poner la seleccionada como habitual
        const [updatedRows] = await AddressGuest.update(
      { usual_shipping_address: true },
            { where: { id: addressId, guest_id: guestId } }
    );

        if (!updatedRows) {
            return res.status(404).json({ message: 'Dirección no encontrada para el guest indicado' });
        }

    const updated = await AddressGuest.findByPk(addressId);

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
