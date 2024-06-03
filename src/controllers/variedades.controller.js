import { Op } from 'sequelize';
import resources from "../resources/index.js";
import { Variedad } from "../models/Variedad.js";



export const variedad_register = async (req, res) => {
    try {

        // { product: '1', valor: 'XL', stock: 5 }
        

        const data = req.body;
        //const variedad_exits = await Variedad.findOne({ where: { valor: data.valor, product: data.product } });
        const variedad_exits = await Variedad.findOne({ where: { valor: data.valor, productId: data.product } });


        let variedad = null;

        if (variedad_exits) {
            data.stock = variedad_exits.stock + data.stock;
            await Variedad.update(data, { where: { id: variedad_exits.id } });
            variedad = await Variedad.findByPk(variedad_exits.id);
        } else {
            variedad = await Variedad.create({
                valor: data.valor,
                stock: data.stock,
                productId: data.product
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

        console.log("---- update variedad multiple ----");
        console.log(req.params);

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
