import axios from 'axios';

const PRINTFUL_API_TOKEN = 'CcbTqhupaIzBCtmkhmnYY59az1Tc8WxIrF9auaGH';

const printfulApi = axios.create({
    baseURL: 'https://api.printful.com',
    headers: {
        'Authorization': `Bearer ${PRINTFUL_API_TOKEN}`
    }
});

export const getPrintfulProductsService = async () => {
    try {
        const response = await printfulApi.get('/store/products');
        return response.data.result;
    } catch (error) {
        console.error('Error fetching Printful products:', error);
        throw new Error('Failed to fetch Printful products');
    }
};

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

export const createPrintfulOrderService = async ( orderData ) => {
    try {
        const response = await printfulApi.post('/orders', orderData);
        return response.data.result;
    } catch ( error ) {
        //console.error('DEBUG createPrintfulOrder: Error al crear la orden en Printful:', error);
        //throw new Error('DEBUG createPrintfulOrder: Error al crear la orden en Printful');

        if (error.response) {
            // El servidor respondió con un estado que no está en el rango de 2xx
            console.error('DEBUG createPrintfulOrder: Error al crear la orden en Printful:', error.response.data);
            throw new Error(`DEBUG createPrintfulOrder: ${error.response.data.error.message}`);
        } else if (error.request) {
            // La solicitud se hizo pero no se recibió respuesta
            console.error('DEBUG createPrintfulOrder: No response received:', error.request);
            throw new Error('DEBUG createPrintfulOrder: No response received from Printful');
        } else {
            // Algo pasó al preparar la solicitud
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