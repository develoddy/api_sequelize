export default {
    product_list: (product, variedades = [], avg_review = 0, count_review = 0, CampaingDiscount = null) => {

        console.log("_____ DEBBUG: REsORUCES - CampaingDiscount", product, CampaingDiscount);

        if (!product) {
            // Si product es null, retornar un objeto vacío o lanzar un error según sea necesario
            return {}; // O lanzar un error o manejar la situación de otra manera
        }
        
        var IMAGEN_TWO = "";
        var GALERIAS = [];

        // console.log(".---resources ver productossss----");
        // console.log(product);

        if (product && product.galerias) { // Verifica que product y product.galerias no sean null
            GALERIAS = product.galerias.map((galeria) => {
                galeria.imagen = process.env.URL_BACKEND+'/api/products/uploads/product/'+galeria.imagen;
                return galeria;
            });

            // Tomamos la última imagen de la galería para 'IMAGEN_TWO'
            GALERIAS.forEach(element => {
                IMAGEN_TWO = element.imagen;
            });
        }

        

        return {
            _id: product.id,
            title: product.title,
            sku: product.sku,
            slug: product.slug,
            imagen: process.env.URL_BACKEND+'/api/products/uploads/product/'+product.portada, // Falta completar la ruta
            categorie:  product.category, // product.categorie,
            price_soles: product.price_soles,
            price_usd: product.price_usd,
            stock: product.stock,
            description: product.description,
            resumen: product.resumen,
            tags: product.tags ? JSON.parse(product.tags) : [],
            type_inventario: product.type_inventario,
            state: product.state,
            variedades: variedades,
            imagen_two: IMAGEN_TWO,
            galerias: GALERIAS,
            avg_review:avg_review,
            count_review:count_review,
            campaing_discount: CampaingDiscount,
        }
    }
}