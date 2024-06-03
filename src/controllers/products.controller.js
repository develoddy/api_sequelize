import { Op } from 'sequelize';
import { sequelize } from '../database/database.js';
import resources from "../resources/index.js";
import { Product } from "../models/Product.js";
import { Categorie } from "../models/Categorie.js";
import { Variedad } from "../models/Variedad.js";
import { Galeria } from "../models/Galeria.js";
import fs from 'fs';
import path from "path";

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

            console.log("--- -ldebbug pordct list-- ");
            console.log(products);
        }

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
        await Product.destroy({ where: { id: _id } });

        res.status(200).json({
            message: "¡Success! El producto se ha eliminado correctamente"
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




    // try {
    //     const files = req.files; // Asumiendo que req.files es un array de archivos si múltiples imágenes se suben
    //     const galerias = req.body.galerias; // Si tienes un cuerpo JSON con un campo galerias

    //     // Verificar si hay archivos subidos
    //     if (!files || files.length === 0) {
    //         return res.status(400).send({
    //             message: "No se subieron imágenes"
    //         });
    //     }

    //     // Encontrar el producto por ID
    //     let product = await Product.findByPk(req.body._id);
        
    //     if (!product) {
    //         return res.status(404).send({
    //             message: "Producto no encontrado"
    //         });
    //     }

    //     // Si galerias ya existe, asegúrate de que sea un array
    //     let currentGalerias = product.galerias ? (Array.isArray(product.galerias) ? product.galerias : JSON.parse(product.galerias)) : [];

    //     // Agregar las nuevas imágenes a galerias
    //     files.forEach(file => {
    //         console.log("---- 1 file: " + file);
    //         var img_path = file.path;
    //         console.log("---- 2 img_path: " + img_path);
    //         var name = img_path.split('/');
    //         console.log("---- 3 name: " + name);
    //         var imagen_name = name[name.length - 1];
    //         console.log("---- 4 imagen_name: " + imagen_name);

    //         currentGalerias.push({
    //             imagen: imagen_name,
    //             _id: req.body.__id // Aquí deberías generar un ID único si __id no es proporcionado
    //         });
    //     });

    //     // Actualizar el campo galerias del producto
    //     product.galerias = currentGalerias;
    //     await product.save();

    //     // Responder al cliente con éxito
    //     res.status(200).json({
    //         message: "Las imágenes se subieron perfectamente",
    //         imagenes: currentGalerias.map(g => ({
    //             imagen: process.env.URL_BACKEND + '/api/products/uploads/product/' + g.imagen,
    //             _id: g._id
    //         }))
    //     });
    // } catch (error) {
    //     res.status(500).send({
    //         message: "debbug: ProductController register_imagen - OCURRIÓ UN PROBLEMA"
    //     });
    //     console.log(error);
    // }



    // try {

    //     if (req.files && req.files.length > 0) {
    //         const portadaFile = req.files.find(file => file.fieldname === 'imagen');
    //         if (portadaFile) {
    //             var img_path = portadaFile.path;
    //             var name = img_path.split('/');
    //             var imagen_name = name[name.length - 1]; // Obtén el último elemento que es el nombre del archivo
    //         }
    //     }

    //     // Buscar el producto por su ID
    //     let product = await Product.findByPk(req.body._id);

    //     if (!product) {
    //         return res.status(404).json({ message: 'Product not found' });
    //     }

    //     // Actualizar el campo galerias del producto
    //     let galerias = product.galerias ? product.galerias : [];
    //     galerias.push({
    //         imagen: imagen_name,
    //         _id: req.body.__id
    //     });

    //     // Guardar los cambios en el producto
    //     product.galerias = galerias;
    //     await product.save();

    //     // Responder con éxito
    //     res.status(200).json({
    //         message: "La imagen se subió perfectamente",
    //         imagen: {
    //             //imagen: imagen_name,
    //             imagen: process.env.URL_BACKEND+'/api/products/uploads/product/'+imagen_name,
    //             _id: req.body.__id
    //         }
    //     });

        
    // } catch (error) {
    //     res.status(500).send({
    //         message: "debbug: ProductController register_imagen - OCURRIÓ UN PROBLEMA"
    //     });
    //     console.log(error);
    // }
}

export const remove_imagen = async(req, res) => {
    try {
        const productId = req.body._id;
        const galeriaId = req.body.__id;

        // Encuentra el producto
        const product = await Product.findByPk(productId);

        if (!product) {
            return res.status(404).json({ message: "Producto no encontrado" });
        }

        // Obtiene la galería del producto y elimina la imagen especificada
        let galerias = product.galerias || [];
        galerias = galerias.filter(galeria => galeria._id !== galeriaId);

        // Actualiza el producto con la nueva galería
        product.galerias = galerias;
        await product.save();

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