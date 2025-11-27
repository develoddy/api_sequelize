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

/** 
 * STORE: SE OBTIENE TODOS LOS PRODUCTOS DE LA TIENDA LUJANDEV (con paginación robusta)
 * - Retry logic: 3 intentos por página
 * - Rate limiting: 300ms entre requests
 * - Validación de duplicados
 * - Protección contra bucle infinito
 */
export const getPrintfulProductsService = async () => {
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 2000; // 2 segundos
  const MAX_PAGES = 100; // Protección contra bucle infinito
  const RATE_LIMIT_DELAY = 300; // 300ms entre requests

  try {
    let allProducts = [];
    let offset = 0;
    const limit = 20; // Printful devuelve máximo 20 productos por página
    let pageCount = 0;

    console.log('📥 [PAGINATION] Iniciando obtención de productos desde Printful...');

    while (pageCount < MAX_PAGES) {
      let retries = 0;
      let success = false;
      let response;

      // RETRY LOGIC PARA CADA PÁGINA
      while (retries < MAX_RETRIES && !success) {
        try {
          console.log(`  📄 [PAGE ${pageCount + 1}] Obteniendo (offset: ${offset}, limit: ${limit}, intento: ${retries + 1}/${MAX_RETRIES})`);
          
          response = await printfulApi.get(`/store/products?offset=${offset}&limit=${limit}`);
          
          // Validar respuesta
          if (!response || !response.data || !response.data.result) {
            throw new Error('Respuesta inválida de Printful API');
          }
          
          success = true;
          
        } catch (error) {
          retries++;
          console.error(`  ❌ [PAGE ${pageCount + 1}] Error, intento ${retries}/${MAX_RETRIES}:`, error.message);
          
          if (retries >= MAX_RETRIES) {
            throw new Error(`Failed to fetch page ${pageCount + 1} after ${MAX_RETRIES} retries: ${error.message}`);
          }
          
          // Esperar antes de reintentar (con backoff exponencial)
          const backoffDelay = RETRY_DELAY * retries;
          console.log(`  ⏳ [PAGE ${pageCount + 1}] Esperando ${backoffDelay}ms antes de reintentar...`);
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
        }
      }

      const products = response.data.result;
      const paging = response.data.paging;

      // Validar información de paginación
      if (!paging || typeof paging.total !== 'number') {
        console.warn('⚠️ [PAGINATION] Información de paginación inválida, finalizando...');
        break;
      }

      allProducts = allProducts.concat(products);
      pageCount++;

      console.log(`  ✅ [PAGE ${pageCount}] Cargada: ${products.length} productos | Total acumulado: ${allProducts.length}/${paging.total}`);

      // Condición de salida
      if (paging.total <= offset + limit || products.length === 0) {
        console.log('🏁 [PAGINATION] Todas las páginas obtenidas');
        break;
      }

      offset += limit;

      // Rate limiting: esperar entre páginas para no exceder límites de API
      if (pageCount < MAX_PAGES && products.length > 0) {
        console.log(`  ⏸️ [RATE LIMIT] Esperando ${RATE_LIMIT_DELAY}ms...`);
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
      }
    }

    if (pageCount >= MAX_PAGES) {
      console.warn(`⚠️ [PAGINATION] Se alcanzó el límite máximo de páginas (${MAX_PAGES})`);
    }

    // Validar y eliminar productos duplicados (protección adicional)
    const uniqueProducts = Array.from(
      new Map(allProducts.map(p => [p.id, p])).values()
    );

    if (uniqueProducts.length !== allProducts.length) {
      console.warn(`⚠️ [DUPLICATES] Se detectaron y eliminaron ${allProducts.length - uniqueProducts.length} productos duplicados`);
    }

    console.log(`✅ [PAGINATION] Total productos únicos obtenidos: ${uniqueProducts.length}`);
    return uniqueProducts;

  } catch (error) {
    console.error('❌ [PAGINATION] Error crítico:', error);
    throw new Error(`Failed to fetch Printful products: ${error.message}`);
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