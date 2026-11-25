import { Op } from 'sequelize';
import { Slider } from "../../../../models/Slider.js";
import SliderResource from "../resources/slider.js";
import { sequelize } from '../../../../database/database.js';
import fs from 'fs';
import path from "path";

const VALID_PLACEMENTS = ['home', 'editorial'];

const VALID_EDITORIAL_CATEGORIES = [
    'default',
    't-shirts',
    'hoodies',
    'mugs',
    'caps'
];

const resolveEditorialCategory = (placement, category) => {
    if (placement !== 'editorial') {
        return null;
    }

    return category === undefined ? 'default' : category;
};

export const register = async(req, res) => {
    try {
        const placement = req.body.placement === undefined
            ? 'home'
            : req.body.placement;

        if (!VALID_PLACEMENTS.includes(placement)) {
            return res.status(400).json({
                message: "Ubicacion del banner no valida"
            });
        }

        if (req.files) {
            const mobileFile = req.files['imagen_mobile'] && req.files['imagen_mobile'][0];
            const desktopFile = req.files['imagen_desktop'] && req.files['imagen_desktop'][0];
            if (mobileFile) {
                req.body.imagen_mobile = mobileFile.filename;
            }
            if (desktopFile) {
                req.body.imagen_desktop = desktopFile.filename;
            }
        }

        const editorialCategory = resolveEditorialCategory(
            placement,
            req.body.editorial_category
        );

        if (
            placement === 'editorial' &&
            !VALID_EDITORIAL_CATEGORIES.includes(editorialCategory)
        ) {
            return res.status(400).json({
                message: "Categoria editorial no valida"
            });
        }

        const slider = await Slider.create({
            placement,
            editorial_category: editorialCategory,
            title: req.body.title,
            subtitle: req.body.subtitle,
            description: req.body.description,
            position: req.body.position || 'middle-left',
            link: req.body.link,
            imagen_mobile: req.body.imagen_mobile,
            imagen_desktop: req.body.imagen_desktop,
            state: req.body.state
        });
        res.status(200).json({
            ...slider.toJSON(),
            ...SliderResource.slider_list(slider)
        });
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
            return SliderResource.slider_list( slider );
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
        const placement = req.body.placement;

        if (
            placement !== undefined &&
            !VALID_PLACEMENTS.includes(placement)
        ) {
            return res.status(400).json({
                message: "Ubicacion del banner no valida"
            });
        }

        if (req.files) {
            const mobileFile = req.files['imagen_mobile'] && req.files['imagen_mobile'][0];
            const desktopFile = req.files['imagen_desktop'] && req.files['imagen_desktop'][0];
            if (mobileFile) {
                req.body.imagen_mobile = mobileFile.filename;
            }
            if (desktopFile) {
                req.body.imagen_desktop = desktopFile.filename;
            }
        }

        const sliderId = req.body._id || req.body.id;
        if (!sliderId) {
          return res.status(400).json({ message: "Slider ID no proporcionado" });
        }

        const existingSlider = await Slider.findByPk(sliderId);

        if (!existingSlider) {
            return res.status(404).json({
                message: "Slider no encontrado"
            });
        }

        const effectivePlacement = placement === undefined
            ? existingSlider.placement
            : placement;

        const requestedCategory = req.body.editorial_category === undefined
            ? (existingSlider.editorial_category ?? undefined)
            : req.body.editorial_category;

        const editorialCategory = resolveEditorialCategory(
            effectivePlacement,
            requestedCategory
        );

        if (
            effectivePlacement === 'editorial' &&
            !VALID_EDITORIAL_CATEGORIES.includes(editorialCategory)
        ) {
            return res.status(400).json({
                message: "Categoria editorial no valida"
            });
        }

        await Slider.update({
            ...(placement !== undefined ? { placement } : {}),
            editorial_category: editorialCategory,
            title: req.body.title,
            subtitle: req.body.subtitle,
            description: req.body.description,
            position: req.body.position || 'middle-left',
            link: req.body.link,
            imagen_mobile: req.body.imagen_mobile,
            imagen_desktop: req.body.imagen_desktop,
            state: req.body.state
        }, { where: { id: sliderId } });

        const SliderT = await Slider.findOne({ where: { id: sliderId } });
        if (!SliderT) {
          return res.status(404).json({ message: "Slider no encontrado" });
        }

        res.status(200).json({
            message: "¡Success! La categoria se ha modificado correctamente",
            slider: SliderResource.slider_list(SliderT),
        });
    } catch (error) {
        res.status(500).send({
            message: "debbug: UserController login - OCURRIÓ UN PROBLEMA"
        });
        console.log(error);
    }
}

export const getEditorial = async(req, res) => {
    try {
        const sliders = await Slider.findAll({
            where: {
                placement: 'editorial',
                state: 1
            },
            order: [
                ['createdAt', 'DESC'],
                ['id', 'DESC']
            ]
        });

        const banners = Object.fromEntries(
            VALID_EDITORIAL_CATEGORIES.map(category => [category, null])
        );

        for (const slider of sliders) {
            const category = slider.editorial_category ?? 'default';

            if (
                VALID_EDITORIAL_CATEGORIES.includes(category) &&
                banners[category] === null
            ) {
                banners[category] = SliderResource.slider_list(slider);
            }
        }

        return res.status(200).json({
            banner: banners.default,
            banners
        });
    } catch (error) {
        console.error('[SliderController] getEditorial:', error);

        return res.status(500).json({
            message: "No se pudo obtener el banner editorial"
        });
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
                let path_img = './src/uploads/slider/default.png';
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