import { Op } from 'sequelize';
import resources from "../resources/index.js";
import { Variedad } from "../models/Variedad.js";

export const variedad_register = async (req, res) => {
    try {
        const data = req.body;
        const variedad_exits = await Variedad.findOne({ where: { valor: data.valor, productId: data.product } });
        let variedad = null;

        if (variedad_exits) {
            data.stock = variedad_exits.stock + data.stock;
            await Variedad.update(data, { where: { id: variedad_exits.id } });
            variedad = await Variedad.findByPk(variedad_exits.id);
        } else {
            variedad = await Variedad.create({
                productId                      : data.product,
                valor                          : data.valor,
                stock                          : data.stock,
                color                          : data.color,
                external_id                    : data.external_id,
                sync_product_id                : data.sync_product_id,
                name                           : data.name,
                synced                         : data.synced,
                variant_id                     : data.variant_id,
                main_category_id               : data.main_category_id,
                warehouse_product_id           : data.warehouse_product_id,
                warehouse_product_variant_id   : data.warehouse_product_variant_id,
                retail_price                   : data.retail_price,
                sku                            : data.sku,
                currency                       : data.currency,
            });
        }

        res.status(200).json({
            variedad: variedad,
        });
        
    } catch (error) {
        res.status(500).send({
            message: "Debug - VariedadController: An error occurred in the register method"
        });
        console.log(error);
    }
}

export const variedad_update = async (req, res) => {
    try {
        const data = req.body;
        await Variedad.update(data, { where: { id: data._id } });
        const variedad = await Variedad.findByPk(data._id);
        res.status(200).json({
            variedad: variedad,
        });
    } catch (error) {
        res.status(500).send({
            message: "Debug - VariedadController: An error occurred in the update method"
        });
        console.log(error);
    }
}

export const variedad_remove = async (req, res) => {
    try {
        const _id = req.params.id;
        await Variedad.destroy({ where: { id: _id } });
        res.status(200).json({
            message: "The variety was deleted successfully",
        });
    } catch (error) {
        res.status(500).send({
            message: "Debug - VariedadController: An error occurred in the delete method"
        });
        console.log(error);
    }
}
