import { Op } from 'sequelize';
import { Slider } from "../models/Slider.js";
import resources from "../resources/index.js";
import { sequelize } from '../database/database.js';
import fs from 'fs';
import path from "path";

export const register = async(req, res) => {
    try {
        if ( req.files && req.files.length > 0 ) {
            const portadaFile = req.files.find(file => file.fieldname === 'portada');
            if ( portadaFile ) {
                var img_path = portadaFile.path;
                var name = img_path.split('/');
                var portada_name = name[name.length - 1]; // Obtén el último elemento que es el nombre del archivo
                req.body.imagen = portada_name;
            }
        }

        const slider = await Slider.create(req.body);
        res.status(200).json(slider);
    } catch (error) {
        res.status(500).send({
            message: "debbug: SliderController register - OCURRIÓ UN PROBLEMA"
        });
        console.log(error);
    }
}

export const list = async(req, res) => {
    try {
        let sliders = null;

        if ( req.query.search && req.query.search.trim() !== '' ) {

            const search = req.query.search.trim();

            sliders = await Slider.findAll({
            where: {
                title: {
                    [Op.like]: `%${search}%`,
                }
            },
            order: [['createdAt', 'DESC']]
        });

        } else {
            // Manejar el caso cuando search no tiene datos
            // Por ejemplo, devolver todos los usuarios sin filtrar
            sliders = await Slider.findAll({ order: [['createdAt', 'DESC']] });
        }

        const formatteherSliders = sliders.map(( slider ) => {
            return resources.Slider.slider_list( slider );
        });

        res.status(200).json({
            sliders: formatteherSliders
        });
    } catch (error) {
        res.status(500).send({
            message: "debbug: SliderController list - OCURRIÓ UN PROBLEMA"
        });
        console.log(error);
    }
}

export const update = async(req, res) => {
    try {
        if ( req.files && req.files.length > 0 ) {
            const portadaFile = req.files.find(file => file.fieldname === 'portada');
            if ( portadaFile ) {
                var img_path = portadaFile.path;
                var name = img_path.split('/');
                var portada_name = name[name.length - 1]; // Obtén el último elemento que es el nombre del archivo
                req.body.imagen = portada_name;
            }
        }

        await Slider.update(req.body, { where: { id: req.body._id } });
        const SliderT = await Slider.findOne({ where: { id: req.body._id } });

        res.status(200).json({
            message: "¡Success! La categoria se ha modificado correctamente",
            slider: resources.Slider.slider_list(SliderT),
        });
    } catch (error) {
        res.status(500).send({
            message: "debbug: UserController login - OCURRIÓ UN PROBLEMA"
        });
        console.log(error);
    }
}

export const remove = async(req, res) => {
    try {
        const slider = await Slider.findByPk(req.query._id); // Busca el slider por su ID

        if (!slider) {
        return res.status(404).json({ message: "El slider no fue encontrado" });
        }

        await slider.destroy(); // Elimina el slider


        res.status(200).json({
            message: "¡Success! El slider se eliminó corectamente"
        });
    } catch (error) {
        res.status(500).send({
            message: "debbug: SliderController remove - OCURRIÓ UN PROBLEMA"
        });
        console.log(error);
    }
}

export const getImage = async(req, res) => {
    try {
        var img = req.params['img'];

        fs.stat('./src/uploads/slider/'+img, function(err){
            if(!err){
                let path_img = './src/uploads/slider/'+img;
                res.status(200).sendFile(path.resolve(path_img));
            }else{
                let path_img = './src/uploads/default.jpg';
                res.status(200).sendFile(path.resolve(path_img));
            }
        })
    } catch (error) {
        res.status(500).send({
            message: "debbug: UserController getImage - OCURRIÓ UN PROBLEMA"
        });
        console.log(error);
    }
}