import { Op } from 'sequelize';
import { Product } from "../models/Product.js";
import { Categorie } from "../models/Categorie.js";
import { Cupone } from "../models/Cupone.js";
import { CuponeProduct } from "../models/CuponeProduct.js";
import { CuponeCategorie } from "../models/CuponeCategorie.js";
import fs from 'fs';
import path from "path";

export const register = async(req, res) => {
    try {
        const data = req.body;

        const existsCupone = await Cupone.findOne({ where: { code: data.code } });

        if (existsCupone) {
            return res.status(200).json({
                message: 403,
                message_text: "¡Failure! El codigo de cupon ya existe"
            });
        }

        // Primero, crea el cupón
        const cupone = await Cupone.create({
            code: data.code,
            type_discount: data.type_discount,
            discount: data.discount,
            type_count: data.type_count,
            num_use: data.num_use,
            type_segment: data.type_segment,
        });

        // Luego, asocia los productos con el cupón
        if (data.products && data.products.length > 0) {
            const products = await Promise.all(data.products.map(async (product) => {
                // Aquí deberías obtener el ID del producto de tu base de datos o donde lo almacenes
                // Supongamos que el ID del producto está en product._id
                const productId = product._id;
                // Crea una entrada en la tabla CuponeProduct para asociar el producto con el cupón
                await CuponeProduct.create({
                    cuponeId: cupone.id,
                    productId: productId
                });
                return product;
            }));
            // Agrega los productos asociados al cupón en el objeto cupone
            cupone.products = products;
        }

        // Asocia las categorías con el cupón
        if (data.categories && data.categories.length > 0) {
            const categories = await Promise.all(data.categories.map(async (category) => {
                // Obtener el ID de la categoría
                const categoryId = category._id;
                // Crea una entrada en la tabla CuponeCategorie para asociar la categoría con el cupón
                await CuponeCategorie.create({
                    cuponeId: cupone.id,
                    categoryId: categoryId
                });
                return category;
            }));
            // Agrega las categorías asociadas al cupón en el objeto cupone
            cupone.categories = categories;
        }

        //const cupone = await Cupone.create(data);

        res.status(200).json({
            message: 200,
            message_text: "¡Success! El cupon se registró correctamente",
            cupone: cupone,
        });
    } catch (error) {
        res.status(500).send({
            message: "debbug: CuponeController register - OCURRIÓ UN PROBLEMA"
        });
        console.log(error);
    }
}

export const update = async(req, res) => {
    try {
        let data = req.body;
        let exists_cupone = await Cupone.findOne({
            where: {
                code: data.code,
                id: { [Op.ne]: data._id }
            }
        });

        if (exists_cupone) {
            res.status(200).json({
                message: 403,
                message_text: "Ups! El codigo de cupon ya existe"
            });
            return;
        }

        await Cupone.update(data, {
            where: { id: data._id }
        });

        let cupone_T = await Cupone.findOne({
            where: { id: data._id }
        });

        res.status(200).json({
            message: 200,
            message_text: "El cupon se actualizó correctamente",
            cupone: cupone_T,
        });
    } catch (error) {
        res.status(500).send({
            message: "debbug: CuponeController update - OCURRIÓ UN PROBLEMA"
        });
        console.log(error);
    }
}

export const remove = async(req, res) => {
    try {

        const cuponeId = req.query._id;

        // Primero, eliminamos los registros relacionados en CuponeProduct
        await CuponeProduct.destroy({
            where: {
                cuponeId: cuponeId
            }
        });

        // Luego, eliminamos los registros relacionados en CuponeCategorie
        await CuponeCategorie.destroy({
            where: {
                cuponeId: cuponeId
            }
        });

        // Finalmente, eliminamos el cupón en la tabla cupones
        const deletedCupone = await Cupone.destroy({
            where: {
                id: cuponeId
            }
        });

        if ( deletedCupone == 1 ) {
            res.status(200).json({
                message: "¡Success! El cupón se borró correctamente"
            });
        } else {
            res.status(404).json({
                message: "¡Ups! El cupón que intenta borrar no existe"
            });
        }

    } catch (error) {
        res.status(500).send({
            message: "debbug: CuponeController remove - OCURRIÓ UN PROBLEMA"
        });
        console.log(error);
    }
}

export const list = async(req, res) => {
    try {

        const search = req.query.search || '';

        let cupones = await Cupone.findAll({
            where: {
                code: {
                    [Op.like]: `%${search}%`
                }
            },
            order: [
                ['createdAt', 'DESC']
            ]
        });


        res.status(200).json({
            message: 200,
            cupones: cupones,
        });
    } catch (error) {
        res.status(500).send({
            message: "debbug: CuponeController list - OCURRIÓ UN PROBLEMA"
        });
        console.log(error);
    }
}

export const show =async(req, res) => {
    try {
        var cupone_id = req.query.cupone_id;

        let cupone = await Cupone.findOne({
            where: { id: cupone_id },
            include: [
                {
                    model: CuponeProduct
                },
                {
                    model: CuponeCategorie
                },
            ]
        });

        res.status(200).json({
            message: 200,
            cupon: cupone,
        });
    } catch (error) {
        res.status(500).send({
            message: "debbug: CuponeController show - OCURRIÓ UN PROBLEMA"
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

        res.status(200).json({
            message: 200,
            products: Products,
            categories: Categories
        });
    } catch (error) {
        res.status(500).send({
            message: "debbug: CuponeController list - OCURRIÓ UN PROBLEMA"
        });
        console.log(error);
    }
}
