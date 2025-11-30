export default {
    //wishlist_list: (wishlist) => {

      // Método para manejar la estructura de wishlist cuando el usuario está autenticado
        /*return {
            _id: wishlist.id,
            user: wishlist.userId,
            product: {
                _id: wishlist.product.id,
                title: wishlist.product.title,
                sku: wishlist.product.sku,
                slug: wishlist.product.slug,
                imagen: process.env.URL_BACKEND+'/api/products/uploads/product/'+wishlist.product.portada,
                categorie: wishlist.product.categorie,
                price_soles: wishlist.product.price_soles,
                price_usd: wishlist.product.price_usd,
            },
            type_discount: wishlist.type_discount,
            discount: wishlist.discount,
            cantidad: wishlist.cantidad,
            variedad: wishlist.variedade,
            code_cupon: wishlist.code_cupon,
            code_discount: wishlist.code_discount,
            price_unitario: wishlist.price_unitario,
            subtotal: wishlist.subtotal,
            total: wishlist.total,
        }
    },*/


    product_list: (wishlist, product, variedades = [], avg_review = 0, count_review = 0, CampaingDiscount = null) => {
        if (!product) {
            // Si product es null, retornar un objeto vacío o lanzar un error según sea necesario
            return {}; // O lanzar un error o manejar la situación de otra manera
        }

        var IMAGEN_TWO = "";
        var GALERIAS = [];

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

          _id: wishlist.id,
          user: wishlist.userId,

          product: {
            _id: product.id,
            title: product.title,
            sku: product.sku,
            slug: product.slug,
            imagen: process.env.URL_BACKEND+'/api/products/uploads/product/'+product.portada, // Falta completar la ruta
            categorie:  product.category, // product.categorie,
            price_eur: product.price_usd, // Unified price in EUR
            price: product.price_usd, // Alias for consistency
            currency: 'EUR',
            price_soles: product.price_soles, // Legacy - deprecated
            price_usd: product.price_usd, // Legacy - deprecated
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
}
