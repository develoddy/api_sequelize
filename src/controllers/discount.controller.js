import { Op } from 'sequelize';
import { Product } from "../models/Product.js";
import { Categorie } from "../models/Categorie.js";
import { Discount } from "../models/Discount.js";
import { DiscountProduct } from "../models/DiscountProduct.js";
import { DiscountCategorie } from "../models/DiscountCategorie.js";
import fs from 'fs';
import path from "path";


export const register = async (req, res) => {
    try {
        let data = req.body;
        let filter_a = [];
        let filter_b = [];


        // Validar que start_date_num y end_date_num estén dentro del rango permitido para BIGINT
        const bigintMin = BigInt(-9223372036854775808);
        const bigintMax = BigInt(9223372036854775807);

        if (BigInt(data.start_date_num) < bigintMin || BigInt(data.start_date_num) > bigintMax) {
            res.status(400).json({
                message: "debug: start_date_num fuera del rango permitido para BIGINT"
            });
            return;
        }

        if (BigInt(data.end_date_num) < bigintMin || BigInt(data.end_date_num) > bigintMax) {
            res.status(400).json({
                message: "debug: end_date_num fuera del rango permitido para BIGINT"
            });
            return;
        }

        if (data.type_segment == 1) {
            filter_a.push({
                id: {
                    [Op.in]: data.product_s
                }
            });
            filter_b.push({
                id: {
                    [Op.in]: data.product_s
                }
            });
        } else {
            filter_a.push({
                id: {
                    [Op.in]: data.categorie_s
                }
            });
            filter_b.push({
                id: {
                    [Op.in]: data.categorie_s
                }
            });
        }

        filter_a.push({
            type_campaign: data.type_campaign,
            start_date_num: {
                [Op.between]: [data.start_date_num, data.end_date_num]
            }
        });

        filter_b.push({
            type_campaign: data.type_campaign,
            end_date_num: {
                [Op.between]: [data.start_date_num, data.end_date_num]
            }
        });

        // Buscar descuentos que coincidan con las fechas de inicio
        let exists_start_date = await Discount.findAll({
            where: {
                [Op.and]: filter_a
            }
        });

        // Buscar descuentos que coincidan con las fechas de fin
        let exists_end_date = await Discount.findAll({
            where: {
                [Op.and]: filter_b
            }
        });

        if (exists_start_date.length > 0 || exists_end_date.length > 0) {
            res.status(200).json({
                message: 403,
                message_text: "El descuento no se puede programar eliminar algunas opciones"
            });
            return;
        }

        // Crear el nuevo descuento
        let discount = await Discount.create(data);

        // Crear relaciones con productos o categorías
        if (data.type_segment == 1) {
            for (let productId of data.product_s) {
                await DiscountProduct.create({ discountId: discount.id, productId });
            }
        } else {
            for (let categoryId of data.categorie_s) {
                await DiscountCategorie.create({ discountId: discount.id, categoryId });
            }
        }

        res.status(200).json({
            message: 200,
            message_text: "Succes! El descuento se registró correctamente",
            discount: discount,
        });
    } catch (error) {
        res.status(500).send({
            message: "debug: DiscountController register - OCURRIÓ UN PROBLEMA"
        });
        console.log(error);
    }
}

export const update = async (req, res) => {
    try {
        let data = req.body;
        let filter_a = [];
        let filter_b = [];

        // Validar que start_date_num y end_date_num estén dentro del rango permitido para BIGINT
        const bigintMin = BigInt(-9223372036854775808);
        const bigintMax = BigInt(9223372036854775807);

        if (BigInt(data.start_date_num) < bigintMin || BigInt(data.start_date_num) > bigintMax) {
            res.status(400).json({
                message: "debug: start_date_num fuera del rango permitido para BIGINT"
            });
            return;
        }

        if (BigInt(data.end_date_num) < bigintMin || BigInt(data.end_date_num) > bigintMax) {
            res.status(400).json({
                message: "debug: end_date_num fuera del rango permitido para BIGINT"
            });
            return;
        }

        if (data.type_segment == 1) {
            filter_a.push({
                id: {
                    [Op.in]: data.product_s
                }
            });
            filter_b.push({
                id: {
                    [Op.in]: data.product_s
                }
            });
        } else {
            filter_a.push({
                id: {
                    [Op.in]: data.categorie_s
                }
            });
            filter_b.push({
                id: {
                    [Op.in]: data.categorie_s
                }
            });
        }

        filter_a.push({
            type_campaign: data.type_campaign,
            start_date_num: {
                [Op.between]: [data.start_date_num, data.end_date_num]
            },
            id: {
                [Op.ne]: data.id
            }
        });

        filter_b.push({
            type_campaign: data.type_campaign,
            end_date_num: {
                [Op.between]: [data.start_date_num, data.end_date_num]
            },
            id: {
                [Op.ne]: data.id
            }
        });

        // Buscar descuentos que coincidan con las fechas de inicio
        let exists_start_date = await Discount.findAll({
            where: {
                [Op.and]: filter_a
            }
        });

        // Buscar descuentos que coincidan con las fechas de fin
        let exists_end_date = await Discount.findAll({
            where: {
                [Op.and]: filter_b
            }
        });

        if (exists_start_date.length > 0 || exists_end_date.length > 0) {
            res.status(200).json({
                message: 403,
                message_text: "El descuento no se puede programar eliminar algunas opciones"
            });
            return;
        }

        // Actualizar el descuento
        await Discount.update(data, {
            where: {
                id: data.id
            }
        });

        let discount = await Discount.findByPk(data.id);

        // Actualizar relaciones con productos o categorías
        if (data.type_segment == 1) {
            // Eliminar relaciones existentes y crear nuevas
            await DiscountProduct.destroy({
                where: { discountId: data.id }
            });
            for (let productId of data.product_s) {
                await DiscountProduct.create({ discountId: data.id, productId });
            }
        } else {
            // Eliminar relaciones existentes y crear nuevas
            await DiscountCategorie.destroy({
                where: { discountId: data.id }
            });
            for (let categoryId of data.categorie_s) {
                await DiscountCategorie.create({ discountId: data.id, categoryId });
            }
        }

        res.status(200).json({
            message: 200,
            message_text: "Succes! El descuento se actualizó correctamente",
            discount: discount,
        });
    } catch (error) {
        res.status(500).send({
            message: "debug: DiscountController update - OCURRIÓ UN PROBLEMA"
        });
        console.log(error);
    }
};

export const show = async (req, res) => {
    try {
        const discount_id = req.query.discount_id;

        // Buscar el descuento por ID
        let discount = await Discount.findOne({
            where: { id: discount_id },
            include: [
                {
                    model: DiscountProduct
                },
                {
                    model: DiscountCategorie
                },
            ]
        });

        if (discount) {
            res.status(200).json({
                message: 200,
                discount: discount,
            });
        } else {
            res.status(404).json({
                message: "Descuento no encontrado"
            });
        }
    } catch (error) {
        res.status(500).send({
            message: "debug: DiscountController show - OCURRIÓ UN PROBLEMA"
        });
        console.log(error);
    }
};

export const list = async(req, res) => {
    try {
        // var search = req.query.search;
        //let discounts = await models.Discount.find().sort({'createdAt': -1});
        let discounts = await Discount.findAll({
            order: [['createdAt', 'DESC']]
        });

        res.status(200).json({
            message: 200,
            discounts: discounts,
        });
    } catch (error) {
        res.status(500).send({
            message: "debbug: DiscountController list - OCURRIÓ UN PROBLEMA"
        });
        console.log(error);
    }
}

export const config = async(req, res) => {
    try {

        let Products = await Product.findAll({ 
            where: { state: 2 },
        });
       
        let Categories = await Categorie.findAll({ 
            where: { state: 1 }
        });
        
        // let Products = await models.Product.find({state:2});
        // let Categories = await models.Categorie.find({state:1});

        res.status(200).json({
            message: 200,
            products: Products,
            categories: Categories
        });
    } catch (error) {
        res.status(500).send({
            message: "debbug: DiscountController config - OCURRIÓ UN PROBLEMA"
        });
        console.log(error);
    }
}

export const remove = async (req, res) => {
    try {

        let id = req.query._id;

        // Eliminar relaciones con productos
        await DiscountProduct.destroy({
            where: { discountId: id }
        });

        // Eliminar relaciones con categorías
        await DiscountCategorie.destroy({
            where: { discountId: id }
        });

        // Eliminar el descuento
        await Discount.destroy({
            where: { id: id }
        });

        res.status(200).json({
            message: 200,
            message_text: "Success! El descuento se eliminó correctamente",
        });
    } catch (error) {
        res.status(500).send({
            message: "debug: DiscountController remove - OCURRIÓ UN PROBLEMA"
        });
        console.log(error);
    }
};
