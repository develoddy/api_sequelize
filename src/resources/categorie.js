export default {
    categorie_list: (categorie) => {
        return {
            _id: categorie.id,
            title: categorie.title,
            imagen: categorie.imagen,
            imagen_home: process.env.URL_BACKEND+'/api/categories/uploads/categorie/'+categorie.imagen,
            state: categorie.state,
        }
    }
}