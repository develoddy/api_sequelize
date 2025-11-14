export default {
    categorie_list: (categorie) => {

        // Prioridad de imagen:
        // 1️⃣ custom_image → si existe (imagen personalizada)
        // 2️⃣ imagen → imagen por defecto de la categoría

        const basePath = `${process.env.URL_BACKEND}/api/categories/uploads/categorie/`;

        const imagenFinal = categorie.custom_image
        ? `${basePath}${categorie.custom_image}`
        : `${basePath}${categorie.imagen}`;

        return {
            _id: categorie.id,
            title: categorie.title,
            imagen: categorie.imagen, // mantiene la imagen original
            custom_image: categorie.custom_image,
            imagen_home: imagenFinal, // ruta final que usa el frontend //process.env.URL_BACKEND+'/api/categories/uploads/categorie/'+categorie.imagen,
            state: categorie.state,
        }
    }
}