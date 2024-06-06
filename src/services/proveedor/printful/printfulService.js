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