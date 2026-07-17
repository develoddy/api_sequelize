export default {
    product_list: (product, variedades = [], avg_review = 0, count_review = 0, CampaingDiscount = null) => {

        
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

        // 🆕 Procesar variedades para incluir Files y ProductVariants
        const processedVariedades = variedades.map(variedad => {
            const variedadData = variedad.toJSON ? variedad.toJSON() : variedad;
            
            // Procesar Files para construir URLs completas
            if (variedadData.files && Array.isArray(variedadData.files)) {
                variedadData.files = variedadData.files.map(file => ({
                    ...file,
                    // Construir URLs completas si son relativas
                    url: file.url?.startsWith('http') ? file.url : (file.url ? `${process.env.URL_BACKEND}/api/products/uploads/product/${file.url}` : null),
                    preview_url: file.preview_url?.startsWith('http') ? file.preview_url : (file.preview_url ? `${process.env.URL_BACKEND}/api/products/uploads/product/${file.preview_url}` : null),
                    thumbnail_url: file.thumbnail_url?.startsWith('http') ? file.thumbnail_url : (file.thumbnail_url ? `${process.env.URL_BACKEND}/api/products/uploads/product/${file.thumbnail_url}` : null),
                }));
            }

            // Añadir imagen de ProductVariants
            if (variedadData.productVariant && variedadData.productVariant.image) {
                variedadData.imagen = variedadData.productVariant.image.startsWith('http') 
                    ? variedadData.productVariant.image 
                    : `${process.env.URL_BACKEND}/api/products/uploads/product/${variedadData.productVariant.image}`;
            }

            return variedadData;
        });

        return {
            _id: product.id,
            title: product.title,
            sku: product.sku,
            slug: product.slug,
            imagen: process.env.URL_BACKEND+'/api/products/uploads/product/'+product.portada, // Falta completar la ruta
            categorie: product.category, // product.categoryId, // product.categorie,
            price_eur: product.price_usd, // Unified price in EUR
            price: product.price_usd, // Alias for consistency
            currency: 'EUR',
            price_soles: product.price_soles, // Legacy - deprecated
            price_usd: product.price_usd, // Legacy - deprecated
            stock: product.stock,
            description_en: product.description_en,
            description_es: product.description_es,
            resumen: product.resumen,
            tags: product.tags ? JSON.parse(product.tags) : [],
            type_inventario: product.type_inventario,
            state: product.state,
            logo_position: product.logo_position,
            idProduct: product.idProduct, // 📏 ¡PRINTFUL ID AÑADIDO!
            variedades: processedVariedades, // 🆕 Variedades con Files y ProductVariants
            imagen_two: IMAGEN_TWO,
            galerias: GALERIAS,
            avg_review:avg_review,
            count_review:count_review,
            campaing_discount: CampaingDiscount,
        }
    }
}