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



export const list = async (req, res) => {
    try {

        let user_id = req.query.user_id;

        if ( user_id ) {
            // Buscar productos en  carrito de compras del usuario
            let carts = await Cart.findAll({
                where: {
                    userId: user_id
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
            message: "debug: CartController list OCURRIÓ UN PROBLEMA"
        });
    }
}

export const register = async (req, res) => {
    try {

        let data = req.body;

        // PRIMERO VAMOS A VALIDAR SI EL PRODUCTO EXISTE EN EL CARRITO DE COMPRA
        if (data.variedad) {
            let valid_cart = await Cart.findOne({
                where: {
                    userId: data.user,
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
            let valid_cart = await Cart.findOne({
                where: {
                    userId: data.user,
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

        console.log("--- Register Cart: ", data);

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
        let newCart = await Cart.create({
            userId: data.user,
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
        let newCartWithAssociations = await Cart.findByPk(newCart.id, {
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

export const removeAll = async (req, res) => {
    try {
        // Obtenemos el user_id desde los parámetros de la solicitud
        let user_id = req.params.user_id;

        // Buscamos todos los productos del carrito del usuario
        let carts = await Cart.findAll({
            where: {
                userId: user_id
            }
        });

        // Si no hay productos en el carrito, enviamos una respuesta 404
        if (carts.length === 0) {
            return res.status(404).json({
                message: "No se encontraron productos en el carrito para el usuario especificado."
            });
        }

        // Eliminamos todos los productos del carrito del usuario
        await Cart.destroy({
            where: {
                userId: user_id
            }
        });

        // Respondemos con un mensaje de éxito
        res.status(200).json({
            message_text: "Todos los productos del carrito han sido eliminados correctamente."
        });

    } catch (error) {
        // En caso de error, enviamos una respuesta 500 y mostramos el error en consola
        console.log("---Debbug removeAll cart:", error);
        res.status(500).send({
            message: "debug: CartController removeAll OCURRIÓ UN PROBLEMA"
        });
    }
}

export const remove = async (req, res) => {
    try {

        let _id = req.params.id;
        let cart = await Cart.findOne({ where: { id: _id } });
        if (cart) {
            //await cart.destroy();
            // Eliminar el carrito específico pasando la condición `where` en el método destroy
            await cart.destroy({ where: { id: _id } });
            res.status(200).json({
                message_text: "El carrito de compra ha sido eliminado correctamente.",
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

        let cart = await Cart.update(data, {
            where: { id: data._id }
        });

        // Volver a buscar el carrito actualizado con las asociaciones necesarias
        let newCart = await Cart.findOne({
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

export const apllyCupon = async (req, res) => {
    try {
        let data = req.body;

        // Validar la existencia del cupón
        let cupon = await Cupone.findOne({
            where: { code: data.code },
            include: [
                { model: CuponeProduct, attributes: ['productId'] },
                { model: CuponeCategorie, attributes: ['categoryId'] }
            ]
        });

        if (!cupon) {
            res.status(200).json({
                message: 403,
                message_text: "El cupón ingresado no es válido. Por favor, inténtelo con otro cupón."
            });
            return;
        }

        // Parte operativa
        let carts = await Cart.findAll({
            where: { userId: data.user_id },
            include: [{ model: Product }]
        });


        let products = cupon.cupones_products.map(cuponeProduct => cuponeProduct.productId);
        let categories = cupon.cupones_categories.map(cuponeCategorie => cuponeCategorie.categoryId);

        for (const cart of carts) {
            let subtotal = 0;
            let total = 0;

            if (products.length > 0 && products.includes(cart.product.id)) {
                if ( cupon.type_discount == 1 ) { // Por porcentaje
                    subtotal = parseFloat((cart.price_unitario - cart.price_unitario * (cupon.discount * 0.01)).toFixed(2));
                } else { // Por moneda
                    subtotal = cart.price_unitario - cupon.discount;
                }

                total = subtotal * cart.cantidad;

                await Cart.update({
                    subtotal: subtotal,
                    total: total,
                    type_discount: cupon.type_discount,
                    discount: cupon.discount,
                    code_cupon: cupon.code,
                }, {
                    where: { id: cart.id }
                });
            }


            if (categories.length > 0 && categories.includes(cart.product.categoryId)) {
                if ( cupon.type_discount == 1 ) { // Por porcentaje
                    subtotal = cart.price_unitario - cart.price_unitario * (cupon.discount * 0.01);
                } else { // Por moneda
                    subtotal = cart.price_unitario - cupon.discount;
                }

                total = subtotal * cart.cantidad;
                await Cart.update({
                    subtotal: subtotal,
                    total: total,
                    type_discount: cupon.type_discount,
                    discount: cupon.discount,
                    code_cupon: cupon.code,
                }, {
                    where: { id: cart.id }
                });
            }
        }

        res.status(200).json({
            message: 200,
            message_text: "El cupón ha sido aplicado correctamente.",
        });
    } catch (error) {
        res.status(500).send({
            message: "debug: CartController applyCupon OCURRIÓ UN PROBLEMA"
        });
        console.log(error);
    }
}


export const mergeCart = async (req, res) => {
    try {
        // Obtener el ID del usuario autenticado desde el token de autenticación
        const user_id = req.query.user_id;
        const localCartItems = req.body.data;  // Carrito local enviado desde el frontend

        if (!user_id) {
            return res.status(400).json({ message: "El ID de usuario es necesario." });
        }

        if (!localCartItems || !Array.isArray(localCartItems) || localCartItems.length === 0) {
            return res.status(400).json({ message: "No se proporcionaron artículos en el carrito." });
        }
        
        // Obtener el carrito del usuario autenticado desde la base de datos
        const backendCartItems = await Cart.findAll({
            where: { userId: user_id },
            include: [
                { model: Variedad, include: { model: File } },
                { model: Product, include: { model: Categorie } }
            ]
        });

        // Crear un conjunto de claves para los artículos existentes en el carrito del backend
        const existingKeys = new Set(backendCartItems.map(item => `${item.productId}-${item.variedadId}`));
       
        // Fusionar los carritos
        const newCartItems = [];

        for (const localItem of localCartItems) {
            const key = `${localItem.product._id}-${localItem.variedad.id}`; // Crear la misma clave

            // Verificar si el producto local ya existe en el carrito del backend
            if (!existingKeys.has(key)) {
                newCartItems.push({
                    userId: user_id,
                    productId: localItem.product._id,
                    variedadId: localItem.variedad.id,
                    type_discount: localItem.type_discount,
                    discount: localItem.discount,
                    cantidad: Number(localItem.cantidad),
                    code_cupon: localItem.code_cupon,
                    code_discount: localItem.code_discount,
                    price_unitario: localItem.price_unitario,
                    subtotal: localItem.subtotal,
                    total: localItem.total
                });
            }
        }

        // Crear los nuevos artículos en el carrito si hay alguno nuevo
        if (newCartItems.length > 0) {
            await Cart.bulkCreate(newCartItems);
        }

        // Volver a cargar el carrito actualizado desde la base de datos
        const updatedCartItems = await Cart.findAll({
            where: { userId: user_id },
            include: [
                { model: Variedad, include: { model: File } },
                { model: Product, include: { model: Categorie } }
            ]
        });

        // Transformar los resultados para enviarlos al frontend
        const CARTS = updatedCartItems.map(cart => resources.Cart.cart_list(cart));

        res.status(200).json({
            carts: CARTS,
            message: 'Carrito fusionado exitosamente'
        });

        // Borrar todos los artículos en cartsCache para el usuario autenticado
        await CartCache.destroy({
            where: { user_status: "Guest" }  // Asegúrate de que se borren solo los del usuario autenticado
        });

    } catch (error) {
        console.error(error);
        res.status(500).send({
            message: "debug: CartController merge: OCURRIÓ UN PROBLEMA"
        });
    }
};



/*export const mergeCart = async (req, res) => {
    try {
        // Obtener el ID del usuario autenticado desde el token de autenticación
        const user_id = req.query.user_id;
        const localCartItems = req.body.data;  // Carrito local enviado desde el frontend

        if (!user_id) {
            return res.status(400).json({ message: "El ID de usuario es necesario." });
        }

        if (!localCartItems || !Array.isArray(localCartItems) || localCartItems.length === 0) {
            return res.status(400).json({ message: "No se proporcionaron artículos en el carrito." });
        }
        
        // Obtener el carrito del usuario autenticado desde la base de datos
        let backendCartItems = await Cart.findAll({
            where: { userId: user_id },
            include: [
                { model: Variedad, include: { model: File } },
                { model: Product, include: { model: Categorie } }
            ]
        });

        // Crear un mapa de los artículos en el carrito del backend para búsqueda rápida
        const backendItemMap = new Map();
        backendCartItems.forEach(item => {
            const key = `${item.productId}-${item.variedadId}`; // Crear una clave única
            backendItemMap.set(key, item);
        });
       
        // Fusionar los carritos
        for (const localItem of localCartItems) {
            const key = `${localItem.product._id}-${localItem.variedad.id}`; // Crear la misma clave

            // Verificar si el producto local ya existe en el carrito del backend
            const existingItem = backendItemMap.get(key);

            if (!existingItem) {
                // Si no existe, agregar el artículo al carrito del backend
                await Cart.create({
                    userId: user_id,
                    productId: localItem.product._id,
                    variedadId: localItem.variedad.id,
                    type_discount: localItem.type_discount,
                    discount: localItem.discount,
                    cantidad: Number(localItem.cantidad),
                    code_cupon: localItem.code_cupon,
                    code_discount: localItem.code_discount,
                    price_unitario: localItem.price_unitario,
                    subtotal: localItem.subtotal,
                    total: localItem.total
                });
            }
        }

        // Volver a cargar el carrito actualizado desde la base de datos
        backendCartItems = await Cart.findAll({
            where: { userId: user_id },
            include: [
                { model: Variedad, include: { model: File } },
                { model: Product, include: { model: Categorie } }
            ]
        });

        // Transformar los resultados para enviarlos al frontend
        const CARTS = backendCartItems.map(cart => resources.Cart.cart_list(cart));

        res.status(200).json({
            carts: CARTS,
            message: 'Carrito fusionado exitosamente'
        });

        // Borrar todos los artículos en cartsCache
        await CartCache.destroy({
            where: { user_status: "Guest" }  // Asegúrate de que se borren solo los del usuario autenticado
        });

    } catch (error) {
        console.error(error);
        res.status(500).send({
            message: "debug: CartController merge: OCURRIÓ UN PROBLEMA"
        });
    }
};*/


/*
export const mergeCart = async (req, res) => {
    try {
        // Obtener el ID del usuario autenticado desde el token de autenticación
        const user_id = req.query.user_id;
        const localCartItems = req.body.data;  // Carrito local enviado desde el frontend

        if (!user_id) {
            return res.status(400).json({ message: "El ID de usuario es necesario." });
        }

        if (!localCartItems || !Array.isArray(localCartItems) || localCartItems.length === 0) {
            return res.status(400).json({ message: "No se proporcionaron artículos en el carrito." });
        }
        
        // Obtener el carrito del usuario autenticado desde la base de datos
        let backendCartItems = await Cart.findAll({
            where: { userId: user_id },
            include: [
                { model: Variedad, include: { model: File } },
                { model: Product, include: { model: Categorie } }
            ]
        });

        // Crear un mapa de los artículos en el carrito del backend para búsqueda rápida
        const backendItemMap = new Map();
        backendCartItems.forEach(item => {
            const key = `${item.productId}-${item.variedadId}`; // Crear una clave única
            backendItemMap.set(key, item);
        });
       

        // Fusionar los carritos
        for (const localItem of localCartItems) {
            
            const key = `${localItem.product._id}-${localItem.variedad.id}`; // Crear la misma clave

            // Verificar si el producto local ya existe en el carrito del backend
            const existingItem = backendItemMap.get(key);

            if (existingItem) {
                // Si existe, actualizar la cantidad (sumarla)
                existingItem.cantidad += localItem.cantidad;
                await existingItem.save();  // Guardar los cambios en la base de datos
            } else {
                // Si no existe, agregar el artículo al carrito del backend
                await Cart.create({
                    userId: user_id,
                    productId: localItem.product._id,
                    variedadId: localItem.variedad.id,
                    type_discount: localItem.type_discount,
                    discount: localItem.discount,
                    cantidad: Number(localItem.cantidad),
                    code_cupon: localItem.code_cupon,
                    code_discount: localItem.code_discount,
                    price_unitario: localItem.price_unitario,
                    subtotal: localItem.subtotal,
                    total: localItem.total
                });
            }
        }

        // Volver a cargar el carrito actualizado desde la base de datos
        backendCartItems = await Cart.findAll({
            where: { userId: user_id },
            include: [
                { model: Variedad, include: { model: File } },
                { model: Product, include: { model: Categorie } }
            ]
        });

        // Transformar los resultados para enviarlos al frontend
        const CARTS = backendCartItems.map(cart => resources.Cart.cart_list(cart));

        res.status(200).json({
            carts: CARTS,
            message: 'Carrito fusionado exitosamente'
        });
    } catch (error) {
        console.error(error);
        res.status(500).send({
            message: "debug: CartController merge: OCURRIÓ UN PROBLEMA"
        });
    }
};
*/
