export default {
    slider_list: (slider) => {
        return {
            _id: slider.id,
            title: slider.title,
            link: slider.link,
            imagen: slider.imagen,
            imagen_home: process.env.URL_BACKEND+'/api/sliders/uploads/slider/'+slider.imagen,
            state: slider.state,
        }
    }
}