import { Op } from 'sequelize';
import resources from "../resources/index.js";
import { Categorie } from "../models/Categorie.js";
import fs from 'fs';
import path from "path";

export const register = async( req, res ) => {
    try {
        if (req.files && req.files.length > 0) {
            const portadaFile = req.files.find(file => file.fieldname === 'portada');
            if (portadaFile) {
                var img_path = portadaFile.path;
                var name = img_path.split('/');
                var portada_name = name[name.length - 1]; // Obtén el último elemento que es el nombre del archivo
                req.body.imagen = portada_name;
            }

            // Imagen personalizada (opcional)
            const customFile = req.files.find(file => file.fieldname === 'custom_image');
            if (customFile) {
                const img_path = customFile.path;
                const name = img_path.split('/');
                const custom_name = name[name.length - 1];
                req.body.custom_image = custom_name;
            }
        }

        const categorie = await Categorie.create(req.body);
        res.status(200).json(categorie);

    } catch ( error ) {
        res.status(500).send({
            message: "debbug: CategorieController register - OCURRIÓ UN PROBLEMA"
        });
        console.log(error);
    }
}

export const update = async(req, res) => {
    try {
        // if (req.files && req.files.length > 0) {
        //     const portadaFile = req.files.find(file => file.fieldname === 'portada');
        //     if (portadaFile) {
        //         var img_path = portadaFile.path;
        //         var name = img_path.split('/');
        //         var portada_name = name[name.length - 1];
        //         req.body.imagen = portada_name;
        //     }
        // }

        // --- Imagen portada ---
        if (req.files?.portada?.length > 0) {
            const portadaFile = req.files.portada[0];
            const img_path = portadaFile.path;
            const name = img_path.split('/');
            const portada_name = name[name.length - 1];
            req.body.imagen = portada_name;
        }

        // --- Imagen personalizada ---
        if (req.files?.custom_image?.length > 0) {
            const customFile = req.files.custom_image[0];
            const img_path = customFile.path;
            const name = img_path.split('/');
            const custom_name = name[name.length - 1];
            req.body.custom_image = custom_name;
        }

        // const customFile = req.files.find(file => file.fieldname === 'custom_image');
        // if (customFile) {
        //     const img_path = customFile.path;
        //     const name = img_path.split('/');
        //     const custom_name = name[name.length - 1];
        //     req.body.custom_image = custom_name;
        // }

        await Categorie.update(req.body, {
            where: {
                id: req.body._id
            }
        });

        const CategorieT = await Categorie.findOne({
            where: {
                id: req.body._id
            }
        });

        res.status(200).json({
            message: "¡Success! La categoria se ha modificado correctamente",
            categorie: resources.Categorie.categorie_list(CategorieT),
        });
    } catch (error) {
        res.status(500).send({
            message: "debbug: UserController update - OCURRIÓ UN PROBLEMA"
        });
        console.log(error);
    }
}

export const list = async (req, res) => {
    try {
        let categories = null;
        const search = req.query.search || '';

        categories = await Categorie.findAll({
            where: {
                title: {
                    [Op.like]: `%${search}%` // Cambiamos ILIKE por LIKE
                }
            },
            order: [['createdAt', 'DESC']]
        });

        categories = categories.map((categorie) => {
            return resources.Categorie.categorie_list(categorie);
        });

        res.status(200).json({
            categories: categories,
        });
    } catch (error) {
        console.error(error);
        res.status(500).send({
            message: "Ocurrió un problema al obtener la lista de categorías"
        });
    }
};

export const remove = async(req, res) => {
    try {

        const deletedCategorie = await Categorie.destroy({
            where: {
                id: req.query._id
            }
         });

        if ( deletedCategorie == 1) {
            res.status( 200 ).json({
                message: "¡Success! La categoria se borro correctamente"
            });

        } else {
            res.status( 404 ).json({
                message: "¡Ups! La categoria que intenta borrar, no existe"
            });
        }
    } catch (error) {
        res.status(500).send({
            message: "debbug: UserController login - OCURRIÓ UN PROBLEMA"
        });
        console.log(error);
    }
}

export const getImage = async (req, res) => {
    try {
        const img = req.params['img'];

        const imgPath = path.resolve('./src/uploads/categorie', img);
        const defaultPath = path.resolve('./src/uploads', 'default.png');

        fs.stat(imgPath, function(err) {
            if (!err) {
                res.status(200).sendFile(imgPath);
            } else {
                res.status(200).sendFile(defaultPath);
            }
        });
    } catch (error) {
        res.status(500).send({
            message: "debug: UserController getImage - OCURRIÓ UN PROBLEMA"
        });
        console.log(error);
    }
}
