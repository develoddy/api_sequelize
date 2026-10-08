import axios from 'axios';

const GELATO_API_TOKEN = process.env.GELATO_API_TOKEN;

const gelatoGeneralApi = axios.create({
    baseURL: 'https://product.gelatoapis.com/v3',
    headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': GELATO_API_TOKEN
    }
});

const gelatoApi = axios.create({
    baseURL: 'https://ecommerce.gelatoapis.com/v1/stores/13ffccb8-bc44-4b15-a11e-2b44b64bec5d',
    headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': GELATO_API_TOKEN
    }
});

export const getGelatiProductsService = async () => {
    try {
        const response = await gelatoApi.get('/products');
        return response.data.products;
    } catch (error) {
        console.error('Error fetching Printful products:', error);
        throw new Error('Failed to fetch Printful products');
    }
};

export const getGelatoProductDetail = async ( productId ) => {
    try {
        const response = await gelatoApi.get(`/products/${productId}`);
        return response.data;
    } catch (error) {
        console.error('DEBUG getProductPrintful: Error al obtener la lista de productos de Printful:', error);
        throw new Error('Error al obtener la lista de productos de Printful');
    }
};

// https://product.gelatoapis.com/v3/products/c88a89ff-908f-4219-aa04-51b8d5d4d16e/prices
export const getGelatoPriceProduct = async ( productId ) => {
    try {
        const response = await gelatoGeneralApi.get(`/products/${productId}/prices`);
        return response.data;
    } catch (error) {
        if (error.response) {
            // El servidor respondió con un código de estado fuera del rango 2xx
            console.error('Error al obtener el precio del producto de Gelato:', error.response.data);
            console.error('Código de estado:', error.response.status);
            console.error('Encabezados:', error.response.headers);
        } else if (error.request) {
            // La solicitud se realizó pero no se recibió respuesta
            console.error('Error al obtener el precio del producto de Gelato. No se recibió respuesta:', error.request);
        } else {
            // Ocurrió un error al configurar la solicitud
            console.error('Error al configurar la solicitud:', error.message);
        }
        throw new Error('Error al obtener el precio del producto de Gelato');
    }
};
