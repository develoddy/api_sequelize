export default {
    slider_list: (slider) => {
        // Extrae solo el nombre del archivo, sin ruta, para mobile y desktop
        const fileNameMobile = slider.imagen_mobile ? slider.imagen_mobile.split(/[\\/]/).pop() : '';
        const fileNameDesktop = slider.imagen_desktop ? slider.imagen_desktop.split(/[\\/]/).pop() : '';
        return {
            _id: slider.id,
            title: slider.title,
            subtitle: slider.subtitle,
            description: slider.description,
            position: slider.position,
            link: slider.link,
            imagen_mobile: slider.imagen_mobile,
            imagen_desktop: slider.imagen_desktop,
            imagen_mobile_url: fileNameMobile ? process.env.URL_BACKEND + '/api/sliders/uploads/slider/' + fileNameMobile : '',
            imagen_desktop_url: fileNameDesktop ? process.env.URL_BACKEND + '/api/sliders/uploads/slider/' + fileNameDesktop : '',
            state: slider.state,
        }
    }
}