import axios from 'axios';

const PRINTFUL_API_TOKEN = process.env.PRINTFUL_API_TOKEN; 

const printfulApi = axios.create({
    baseURL: 'https://api.printful.com',
    headers: {
        'Authorization': `Bearer ${PRINTFUL_API_TOKEN}`
    }
});

export const getPrintfulShippingRatesService = async (payload) => {
    try {
        const response = await printfulApi.post('/shipping/rates', payload);
        return response.data.result;
    } catch (error) {
        console.error('Error fetching Printful Shipping Rates:', error);
        throw new Error('Error fetching Printful Shipping Rates');
    }
};

/** STORE: SE OBTIENE TODOS LOS PRODUCTOS DE LA TIENDA LUJANDEV (con paginación) */
export const getPrintfulProductsService = async () => {
  try {
    let allProducts = [];
    let offset = 0;
    const limit = 20; // Printful devuelve máximo 20 productos por página

    while (true) {
      const response = await printfulApi.get(`/store/products?offset=${offset}&limit=${limit}`);
      const products = response.data.result;
      const paging = response.data.paging;

      allProducts = allProducts.concat(products);

      console.log(`🔄 Página cargada: offset ${offset} | Productos: ${products.length}`);

      // Si ya no hay más productos, rompemos el bucle
      if (paging.total <= offset + limit) break;

      offset += limit;
    }

    console.log(`✅ Total productos obtenidos de Printful: ${allProducts.length}`);
    return allProducts;

  } catch (error) {
    console.error('Error fetching Printful products:', error);
    throw new Error('Failed to fetch Printful products');
  }
};

/** STORE: SE OBTIENE EL DETALLE DEL PRODUCTO SELECCIONADO */
export const getPrintfulProductDetail = async ( productId ) => {
    try {
        const response = await axios.get(`https://api.printful.com/store/products/${productId}`, {
            headers: {
                'Authorization': `Bearer ${PRINTFUL_API_TOKEN}`
            }
        });
        return response.data.result;
    } catch (error) {
        console.error('DEBUG getProductPrintful: Error al obtener la lista de productos de Printful:', error);
        throw new Error('Error al obtener la lista de productos de Printful');
    }
};

/** CATALOG: SE OBTIENE EL DETALLE DEL PRODUCTO + VARIANTE */
export const getPrintfulCatalogProductDetail = async ( productId ) => {
    try {
        const response = await axios.get(`https://api.printful.com/products/${productId}`, {
            headers: {
                'Authorization': `Bearer ${PRINTFUL_API_TOKEN}`
            }
        });
        return response.data.result;
    } catch (error) {
        console.error('DEBUG getProductPrintful: Error al obtener la lista de productos de Printful:', error);
        throw new Error('Error al obtener la lista de productos de Printful');
    }
};

export const createPrintfulOrderService = async ( orderData ) => {
    try {

        // 1. Obtener la estimación real de entrega desde Printful antes de crear la orden
        const shippingRatesRes = await printfulApi.post('/shipping/rates', {
            recipient: orderData.recipient,
            items: orderData.items,
            currency: "EUR",
            locale: "es_ES"
        });

        //console.log("---> API createPrintfulOrderService > shippingRatesRes: " , shippingRatesRes.data.result);
        //return;

        const selectedRate = shippingRatesRes.data.result[0];
        const minDeliveryDate = selectedRate.minDeliveryDate; // ya formateado YYYY-MM-DD
        const maxDeliveryDate = selectedRate.maxDeliveryDate;

        // 2. Crear pedido en modo borrador
        const createOrderRes = await printfulApi.post('/orders', orderData);
        const createdOrder = createOrderRes.data.result;

        // 3. Obtener detalles (opcional pero útil para dashboard_url, costos, etc.)
        const detailsRes = await printfulApi.get(`/orders/${createdOrder.id}`);
        const orderDetails = detailsRes.data.result;

        // 4. Devolver todos los datos necesarios al controller
        return {
            orderId: orderDetails.id,
            shippingServiceName: orderDetails.shipping_service_name,
            shippingCost: parseFloat(orderDetails.costs.shipping),
            minDeliveryDate,
            maxDeliveryDate,
            dashboardUrl: orderDetails.dashboard_url,
            raw: orderDetails
        };

    } catch ( error ) {
        if (error.response) {
            console.error('DEBUG createPrintfulOrder: Error al crear la orden en Printful:', error.response.data);
            throw new Error(`DEBUG createPrintfulOrder: ${error.response.data.error.message}`);
        } else if (error.request) {
            console.error('DEBUG createPrintfulOrder: No response received:', error.request);
            throw new Error('DEBUG createPrintfulOrder: No response received from Printful');
        } else {
            console.error('DEBUG createPrintfulOrder: Error al preparar la solicitud:', error.message);
            throw new Error('DEBUG createPrintfulOrder: Error al preparar la solicitud a Printful');
        }
    }
};

export const getPrintfulCategory = async ( categoryId ) => {
    try {
        const response = await axios.get(`https://api.printful.com/categories/${categoryId}`, {
            headers: {
                'Authorization': `Bearer ${PRINTFUL_API_TOKEN}`
            }
        });
        return response.data.result;

    } catch (error) {
        console.error('DEBUG getProductPrintful: Error al obtener la lista de productos de Printful:', error);
        throw new Error('Error al obtener la lista de productos de Printful');
    }
};