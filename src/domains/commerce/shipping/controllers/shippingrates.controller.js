import { Op } from 'sequelize';
import { AddressClient } from "../../../../models/AddressClient.js";
import { User } from "../../../../models/User.js";

import { getShippingRates } from '../../integrations/printful/controllers/shippingratesPrintful.controller.js';

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
        console.error('❌ Error al obtener tarifas de envío de Printful:', error?.response?.data || error.message);
        
        // Extraer mensaje de error específico de Printful
        let errorMessage = "Error al consultar las tarifas de envío.";
        let errorCode = 'shipping_error';
        
        if (error?.response?.data) {
            const printfulError = error.response.data;
            
            if (printfulError.result) {
                errorMessage = printfulError.result;
            } else if (printfulError.error?.message) {
                errorMessage = printfulError.error.message;
            }
            
            // Determinar código de error específico
            const errorLower = errorMessage.toLowerCase();
            if (errorLower.includes('zip') || errorLower.includes('postal')) {
                errorCode = 'invalid_zip';
            } else if (errorLower.includes('address')) {
                errorCode = 'invalid_address';
            } else if (errorLower.includes('country')) {
                errorCode = 'unsupported_country';
            } else if (errorLower.includes('variant')) {
                errorCode = 'invalid_variant';
            }
        }
        
        res.status(error?.response?.status || 500).json({
            success: false,
            status: error?.response?.status || 500,
            message: errorMessage,
            error: {
                code: errorCode,
                message: errorMessage
            }
        });
    }
}