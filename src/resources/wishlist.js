export default {
    wishlist_list: (wishlist) => {
        return {
            _id: wishlist.id,
            user: wishlist.userId,
            product: {
                _id: wishlist.product.id,
                title: wishlist.product.title,
                sku: wishlist.product.sku,
                slug: wishlist.product.slug,
                imagen: process.env.URL_BACKEND+'/api/products/uploads/product/'+wishlist.product.portada, // Falta completar la ruta
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
    }
}
