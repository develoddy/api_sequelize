import { Op } from 'sequelize';
import { sequelize } from '../database/database.js';
import resources from "../resources/index.js";
import { Product } from "../models/Product.js";
import { Categorie } from "../models/Categorie.js";
import { Variedad } from "../models/Variedad.js";
import { Galeria } from "../models/Galeria.js";
import { File } from "../models/File.js";
import { Option } from "../models/Option.js";
import { Cart } from "../models/Cart.js";
import { Wishlist } from "../models/Wishlist.js";
import { SaleDetail } from "../models/SaleDetail.js";


import fs from 'fs';
import path from "path";
import { getPrintfulProducts } from './proveedor/printful/productPrintful.controller.js';
import { getGelatoProducts } from './proveedor/gelato/productGelato.controller.js';

//  ----- START PROVEDORES ------
export const syncPrintfulProducts = async (req, res) => {
    try {
        const printfulProducts = await getPrintfulProducts();
        res.status( 200 ).json({
            sync: true,
        });
    } catch (error) {
        res.status( 500 ).send({
            message: "debbug: ProductController syncPrintfulProducts - OCURRIÓ UN PROBLEMA"
        });
        console.log(error);
    }
}

export const syncGelatoProducts = async (req, res) => {
    try {
        await getGelatoProducts();
        res.status( 200 ).json({
            sync: true,
        });
    } catch (error) {
        res.status( 500 ).send({
            message: "debbug: ProductController syncGelatoProducts - OCURRIÓ UN PROBLEMA"
        });
        console.log(error);
    }
}
//  ----- END PROVEDORES ------



/* ============= ENDPOINTS ============= */
export const register = async(req, res) => {
    try {
        let data = req.body;

        const valid_Product = await Product.findOne({ where: { title: data.title }} );

        if( valid_Product ) {
            res.status(200).send({
                code: 403,
                message: "El producto ya existe"
            });
            return;
        }

        data.slug = data.title.toLowerCase().replace(/ /g,'-').replace(/[^\w-]+/g,'');

        if (req.files && req.files.length > 0) {
            const portadaFile = req.files.find(file => file.fieldname === 'imagen');
            if (portadaFile) {
                var img_path = portadaFile.path;
                var name = img_path.split('/');
                var portada_name = name[name.length - 1]; // Obtén el último elemento que es el nombre del archivo
                data.portada = portada_name;
            }
        }

        data.categoryId = data.categorie;

        let product = await Product.create( data );

        res.status(200).json({
            message: "¡Success! El Producto se ha registrado correctamente"
        });

    } catch (error) {
        res.status(500).send({
            message: "Debugg: ProducController - Ocurrio un problema en Register"
        });
    }
}

export const update = async(req, res) => {
    try {
        let data = req.body;

        data.categoryId = data.categorie;

        let valid_Product = await Product.findOne({
            where: {
                title: data.title,
                id: { [ Op.ne ]: data._id }
            }
        });

        if( valid_Product ) {
            res.status(200).send({
                code: 403,
                message: "¡Ups! El producto ya existe"
            });
            return;
        }


        // Utilizando Sequelize para buscar los carritos del usuario
        let carts = await Cart.findAll({
            where: {
                productId: data._id,
            },
            include: [
                { model: Variedad, include: { model: File } },
                { model: Product, include: { model: Categorie } }
            ]
        });


        // Filtrar y eliminar productos que ya no existen o que están ignorados
        for (let cart of carts) {
            // Verifica si el producto ha sido eliminado o está en estado ignorado
            if (cart.product.state == 1) {
                console.log(`Simulacion de Producto con ID ${cart.productId} ha sido eliminado. Se eliminará del carrito :(.`);
                // Eliminar el item del carrito
                await Cart.destroy({ where: { id: cart.id } });
            } else {
                //console.log(`API 59 Simulacion de Producto con ID ${cart.productId} aun puede estar en carrito. porque existe en la DB :)`);
                console.log("API 136 > update else: ", JSON.stringify(cart, null, 2));
            }
        }



        data.slug = data.title.toLowerCase().replace(/ /g,'-').replace(/[^\w-]+/g,'');

        if ( req.files && req.files.length > 0 ) {
            const portadaFile = req.files.find(file => file.fieldname === 'imagen');
            if (portadaFile) {
                var img_path = portadaFile.path;
                var name = img_path.split('/');
                var portada_name = name[name.length - 1]; // Obtén el último elemento que es el nombre del archivo
                data.portada = portada_name;
            }
        }



        await Product.update(data, { where: { id: data._id } });

        res.status(200).json({
            message: "¡Success! El Registro se ha modificado correctamente"
        });

    } catch (error) {
        console.log(error);
        res.status(500).send({
            message: "Debugg: ProducController - Ocurrio un problema en Update"
        });
    }
}

export const list = async ( req, res ) => {
    try {
        var filter  = [];
        var products = null;

        if ( req.query.search ) {
            filter.push({
                title: {
                    [Op.like]: `%${req.query.search}%` // Utilizamos Op.like para buscar insensitivo a mayúsculas y minúsculas
                }
            });
        }
        if ( req.query.categorie ) {
            filter.push({
                categoryId: req.query.categorie // Asumiendo que la relación se llama categorieId en el modelo de Producto
            });
        }

        if( filter.length > 0 ) {

            products = await Product.findAll({
                where: {
                    [Op.and]: filter // Utilizamos Op.and para la lógica $and
                },
                include: [Categorie] // Utilizamos include para realizar la operación de populate
            });

            products = products.map( product => {
                return resources.Product.product_list( product );
            });
        } else {
            // BUSCAR LAS CATEGORIAS
            products = await Product.findAll({
                include: {
                    model: Categorie,
                }
            });

            products = products.map( product => {
                return resources.Product.product_list( product );
            });
        }

        // Obtener productos de Printful
        // const printfulProducts = await getPrintfulProducts();
        //await getPrintfulProducts();

        res.status( 200 ).json({
            products: products,
        });

    } catch ( error ) {
        res.status( 500 ).send({
            message: "debbug: ProductController list - OCURRIÓ UN PROBLEMA"
        });
        console.log(error);
    }
}

export const remove = async(req, res) => {
    try {
        let _id = req.query._id;

        // Encuentra el producto por ID
        const product = await Product.findByPk(_id);
        if ( !product ) {
            return res.status(404).json({
                message: "El producto no se encontró."
            });
        }

        await Galeria.destroy({ where: { productId: _id } });

        await Wishlist.destroy({ where: { productId: _id } });

        await Cart.destroy({ where: { productId: _id } });



        // Obtén todas las variedades del producto
        const variedades = await Variedad.findAll({ where: { productId: _id } });

        // Elimina los archivos asociados a cada variedad
        for (const variedad of variedades) {

            await SaleDetail.destroy({ where: { productId: _id, variedadId: variedad.id } });

            // Elimina las opciones asociadas a cada variedad
            await Option.destroy({ where: { varietyId: variedad.id } });

            // Elimina los archivos asociados a cada variedad
            await File.destroy({ where: { varietyId: variedad.id } });
        }

        await Variedad.destroy({ where: { productId: _id } });

        // Guarda el categoryId del producto antes de eliminarlo
        const categoryId = product.categoryId;

        // Elimina el producto
        await Product.destroy({ where: { id: _id } });

        // Verifica si la categoría no está asociada a otros productos antes de eliminarla
        const categoryInUse = await Product.findOne({ where: { categoryId: categoryId } });
        if (!categoryInUse) {
            await Categorie.destroy({ where: { id: categoryId } });
        }

        res.status(200).json({
            message: "El producto, sus variedades, opciones, archivos y categoría se han eliminado correctamente."
        });
    } catch (error) {
        res.status(500).send({
            message: "debbug: ProductController remove - OCURRIÓ UN PROBLEMA"
        });
        console.log(error);
    }
}

export const getImage = async(req, res) => {
    try {

        const img = req.params['img'];

        const imgPath = path.resolve('./src/uploads/product', img);
        const defaultPath = path.resolve('./src/uploads', 'default.jpg');

        fs.stat(imgPath, function(err) {
            if (!err) {
                res.status(200).sendFile(imgPath);
            } else {
                res.status(200).sendFile(defaultPath);
            }
        });
    } catch (error) {
        res.status(500).send({
            message: "debbug: ProductController getImage - OCURRIÓ UN PROBLEMA"
        });
        console.log(error);
    }
}

export const register_imagen = async(req, res) => {
    try {
        const galerias = [];
        if (req.files && req.files.length > 0) {
            const portadaFile = req.files.find(file => file.fieldname === 'imagen');
            if (portadaFile) {
                var img_path = portadaFile.path;
                var name = img_path.split('/');
                var imagen_name = name[name.length - 1]; // Obtén el último elemento que es el nombre del archivo

                const galeria = await Galeria.create({
                    imagen: imagen_name,
                    color: req.body.color,
                    productId: req.body._id,
                });

                galerias.push(galeria);

                // Asociar las galerías al producto
                const product = await Product.findByPk( req.body._id );
                if ( !product ) {
                    return res.status(404).json({ message: 'Producto no encontrado' });
                }

                await product.addGalerias(galerias);

                res.status(200).json({
                    message: "La imagen se subió perfectamente",
                    imagen: {
                        //imagen: imagen_name,
                        imagen: process.env.URL_BACKEND+'/api/products/uploads/product/'+imagen_name,
                        _id: galeria.id
                    }
                });
            }
        }

    } catch (error) {
        console.error('Error al registrar las imágenes:', error);
        res.status(500).json({ message: 'Error del servidor al registrar las imágenes' });
    }
}

export const remove_imagen = async(req, res) => {
    try {
        const productId = req.body._id;
        const galeriaId = req.body.__id;

        await Galeria.destroy({ where: { id: galeriaId } });

        res.status(200).json({
            message: "La imagen se eliminó perfectamente",
        });
    } catch (error) {
        res.status(500).send({
            message: "debbug: ProductController remove_imagen - OCURRIÓ UN PROBLEMA"
        });
        console.log(error);
    }
}

export const show = async(req, res) => {
    try {
        var product_id = req.params.id;

        const product = await Product.findOne({
            where: {
                id: product_id,
            },
            include: [
                {
                    model: Galeria
                },
                {
                    model: Categorie
                },
            ]
        });

        if (!product) {
            return res.status(404).json({ message: "¡Ups! Producto no encontrado" });
        }

        // Encuentra las variedades asociadas al producto
        const variedades = await Variedad.findAll({
            where: { productId: product_id }
        });

        res.status(200).json({
            product: resources.Product.product_list(product, variedades)
        });
    } catch (error) {
        res.status(500).send({
            message: "debbug: ProductController show - OCURRIÓ UN PROBLEMA"
        });
        console.log(error);
    }
}
