export default {
    cart_list: (cart) => {
        return {
            _id: cart.id,
            user: cart.userId,
            product: {
                _id: cart.product.id,
                title: cart.product.title,
                sku: cart.product.sku,
                slug: cart.product.slug,
                imagen: process.env.URL_BACKEND+'/api/products/uploads/product/'+cart.product.portada, // Falta completar la ruta
                categorie: cart.product.categorie,
                price_soles: cart.product.price_soles,
                price_usd: cart.product.price_usd,
            },
            type_discount: cart.type_discount,
            discount: cart.discount,
            cantidad: cart.cantidad,
            variedad: cart.variedade,
            code_cupon: cart.code_cupon,
            code_discount: cart.code_discount,
            price_unitario: cart.price_unitario,
            subtotal: cart.subtotal,
            total: cart.total,
        }
    }
}