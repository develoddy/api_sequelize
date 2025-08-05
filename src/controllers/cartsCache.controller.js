import { Op } from 'sequelize';
import { sequelize } from '../database/database.js';
// MODELS
import { Slider } from "../models/Slider.js";
import { Categorie } from "../models/Categorie.js";
import { Discount } from "../models/Discount.js";
import { Product } from "../models/Product.js";
import { Variedad } from "../models/Variedad.js";
import { File } from "../models/File.js";
import { Review } from "../models/Review.js";
import { User } from "../models/User.js";
import { Galeria } from "../models/Galeria.js";
import { DiscountProduct } from "../models/DiscountProduct.js";
import { DiscountCategorie } from "../models/DiscountCategorie.js";
import { SaleDetail } from '../models/SaleDetail.js';
import { Sale } from '../models/Sale.js';
import { SaleAddress } from "../models/SaleAddress.js";
import { AddressClient } from "../models/AddressClient.js";
import { Cart } from "../models/Cart.js";
import { CartCache } from "../models/CartCache.js";
import { Cupone } from "../models/Cupone.js";
import { CuponeProduct } from "../models/CuponeProduct.js";
import { CuponeCategorie } from "../models/CuponeCategorie.js";

// RESOURCES
import resources from "../resources/index.js";
import bcrypt from 'bcryptjs';

export const register = async (req, res) => {
    try {

        let data = req.body;

        // PRIMERO VAMOS A VALIDAR SI EL PRODUCTO EXISTE EN EL CARRITO DE COMPRA
        if (data.variedad) {
            let valid_cart = await CartCache.findOne({
                where: {
                    guest_id: data.user,
                    variedadId: data.variedad,
                    productId: data.product,
                }
            });
            if (valid_cart) {
                res.status(200).json({
                    message: 403,
                    message_text: "El producto con esta variedad ya se encuentra en su carrito de compra",
                });
                return;
            }
        } else {
            // AQUÍ SERÍA PRODUCTO DE INVENTARIO UNITARIO
            let valid_cart = await CartCache.findOne({
                where: {
                    guest_id: data.user,
                    productId: data.product,
                }
            });
            if (valid_cart) {
                res.status(200).json({
                    message: 403,
                    message_text: "Este producto ya se encuentra en su carrito de compra",
                });
                return;
            }
        }

        // SEGUNDO VAMOS A VALIDAR SI EL STOCK ESTÁ DISPONIBLE
        if (data.variedad) {

            if( data.variedad == 'multiple' ) {
                return;
            }

            let valid_variedad = await Variedad.findOne({
                where: {
                    id: data.variedad,
                }
            });
            if (valid_variedad.stock < data.cantidad) {
                res.status(200).json({
                    message: 403,
                    message_text: "V El stock no está disponible en este momento.",
                });
                return;
            }
        } else {
            // AQUÍ SERÍA PRODUCTO DE INVENTARIO UNITARIO
            let valid_product = await Product.findOne({
                where: {
                    id: data.product,
                }
            });

            if (valid_product.stock < data.cantidad) {
                res.status(200).json({
                    message: 403,
                    message_text: "P IU El stock no está disponible en este momento.",
                });
                return;
            }
        }

        // Insertar en la tabla Cart
        let newCart = await CartCache.create({
            guest_id: data.user,
            user_status: data.user_status,
            productId: data.product,
            variedadId: data.variedad,
            type_discount: data.type_discount,
            discount: data.discount,
            cantidad: data.cantidad,
            code_cupon: data.code_cupon,
            code_discount: data.code_discount,
            price_unitario: data.price_unitario,
            subtotal: data.subtotal,
            total: data.total
        });        

        // Obtener el carrito con las asociaciones
        let newCartWithAssociations = await CartCache.findByPk(newCart.id, {
            include: [
                { model: Variedad, include: { model: File }  },
                { model: Product, include: { model: Categorie } }
            ]
        });

        res.status(200).json({
            cart: resources.Cart.cart_list(newCartWithAssociations.toJSON()),
            message_text: "La cesta de compra ha sido registrado satisfactoriamente",
        });
    } catch (error) {
        res.status(500).send({
            message: "debug: CartController register: OCURRIÓ UN PROBLEMA"
        });
        console.log(error);
    }
}

export const list = async (req, res) => {
    try {

        let isGuest = req.query.isGuest;

        if ( isGuest ) {
            // Buscar productos en  carrito de compras del usuario
            let carts = await CartCache.findAll({
                where: {
                    user_status: isGuest
                },
                include: [
                    { model: Variedad, include: { model: File } },
                    { model: Product, include: { model: Categorie } }
                ]
            });

            // Mapeando los resultados para transformarlos según sea necesario
            let CARTS = carts.map(cart => {
                return resources.Cart.cart_list(cart);
            });

            // Enviando la respuesta
            res.status(200).json({
                carts: CARTS,
            });

        } else {
            // Si no hay usuario autenticado, devolver un carrito vacío o el carrito desde el frontend
            res.status(200).json({ carts: [] });
        }
    } catch (error) {
        console.log(error);
        res.status(500).send({
            message: "debug: CartController list OCURRIÓ UN PROBLEMA " + error
        });
    }
}

export const removeAll = async (req, res) => {
    try {
        // Obtenemos el user_id desde los parámetros de la solicitud
        let isGuest = req.params.isGuest;


        // Buscamos todos los productos del carrito del usuario
        let carts = await CartCache.findAll({
            where: {
                user_status: isGuest
            }
        });

        // Si no hay productos en el carrito, enviamos una respuesta 404
        if (carts.length === 0) {
            return res.status(404).json({
                message: "No se encontraron productos en el carrito para el usuario especificado."
            });
        }

        // Eliminamos todos los productos del carrito del usuario
        await CartCache.destroy({
            where: {
                user_status: isGuest
            }
        });

        // Respondemos con un mensaje de éxito
        res.status(200).json({
            message_text: "Todos los productos del carrito han sido eliminados correctamente."
        });

    } catch (error) {
        res.status(500).send({
            message: "debug: CartController removeAll OCURRIÓ UN PROBLEMA"
        });
    }
}

export const remove = async (req, res) => {
    try {

        let _id = req.params.id;
        //let isGuest = req.params.isGuest;
        let cart = await CartCache.findOne({ where: { id: _id } });
        if (cart) {
            //await CartCache.destroy();
            // Eliminar el carrito específico pasando la condición `where` en el método destroy
            await CartCache.destroy({ where: { id: _id  } });
            res.status(200).json({
                message_text: "El carrito de cache ha sido eliminado correctamente",
            });
        } else {
            res.status(404).json({
                message: "Cesta no encontrado."
            });
        }
    } catch (error) {
        res.status(500).send({
            message: "debug: CartController delete OCURRIÓ UN PROBLEMA"
        });
        console.log(error);
    }
}

export const update = async (req, res) => {
    try {
        let data = req.body;

        // Validar si el stock está disponible
        if ( data.variedad ) {
            let validVariedad = await Variedad.findOne({
                where: { id: data.variedad }
            });

            if ( validVariedad.stock < data.cantidad ) {
                res.status(200).json({
                    message: 403,
                    message_text: "Lo sentimos, ha excedido la cantidad máxima disponible en el stock.",
                });
                return;
            }
        } else {
            // Aquí sería producto de inventario unitario
            let validProduct = await Product.findOne({
                where: { id: data.product }
            });

            if (validProduct.stock < data.cantidad) {
                res.status(200).json({
                    message: 403,
                    message_text: "Lo sentimos, ha excedido la cantidad máxima disponible en el stock.",
                });
                return;
            }
        }

        let cart = await CartCache.update(data, {
            where: { id: data._id }
        });

        // Volver a buscar el carrito actualizado con las asociaciones necesarias
        let newCart = await CartCache.findOne({
            where: { id: data._id },
            include: [
                { model: Variedad },
                {
                    model: Product,
                    include: [{ model: Categorie }]
                }
            ]
        });

        res.status(200).json({
            cart: resources.Cart.cart_list(newCart),
            message_text: "La cesta se actualizó con éxito!",
        });
    } catch (error) {
        res.status(500).send({
            message: "debug: CartController OCURRIÓ UN PROBLEMA"
        });
        console.log(error);
    }
}

