import { Op } from 'sequelize';
import { AddressClient } from "../models/AddressClient.js";
import { User } from "../models/User.js";

import { getShippingRates } from './proveedor/printful/shippingratesPrintful.controller.js';

export const shippingRates = async (req, res) => {
    try {
        const { recipient, items, currency = 'EUR', locale = 'es_ES' } = req.body;

        if (!recipient || !items || items.length === 0) {
            return res.status(400).json({ message: "Faltan datos de destino o productos." });
        }

        const payload = {
            recipient,
            items,
            currency,
            locale
        };

        const result = await getShippingRates(payload); // 🔧 pasa el payload

        res.status(200).json({
            status: 200,
            result
        });
    } catch (error) {

        console.error('Error al obtener tarifas de envío de Printful:', error?.response?.data || error.message);
        res.status(500).json({
            success: false,
            message: "Error al consultar las tarifas de envío."
        });

    }
}