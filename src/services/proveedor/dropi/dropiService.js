import axios from 'axios';

let dropiApi = null;

/*
 * Para manejar diferentes endpoints según el país (Perú o España) en tu servicio, 
 * puedes ajustar el código para aceptar un parámetro adicional 
 * que determine el país y, en función de ese parámetro, establecer 
 * la URL base adecuada.
 **/
const getDropiApiUrl = ( country ) => {
  switch ( country ) {
      case 'pe':
          return 'https://api.dropi.pe/api';
      case 'es':
          return 'https://api.dropi.com.es/api';
      default:
          throw new Error('Country not supported');
  }
};

/*
 * Agrega un parámetro country que determine cuál endpoint usar. Dependiendo del 
 * valor de country, se configurará la URL base para las peticiones.
 **/
export const authenticateDropi = async ( 
  email, 
  password, 
  white_brand_id, 
  country 
) => {

    try {
      const DROP_API_URL = getDropiApiUrl(country);

      const response = await axios.post(`${DROP_API_URL}/login`, {
        email: email,
        password: password,
        white_brand_id: white_brand_id
      });

      if ( response.data.isSuccess ) {
          
          const token = response.data.token;

          // Crear una instancia de axios configurada con el token de autenticación
          dropiApi = axios.create({
              baseURL: DROP_API_URL,
              headers: {
                  'Authorization': `Bearer ${token}`
              }
          });

          return token;

      } else {
        return null;
      }
    } catch ( error ) {
        console.error('Error autenticando con Dropi:', error.message);
        return null;
    }
};



// --------------- OPERACIONES -------------------
/*
 * Se llama a este servicio para obtener productos u 
 * otras funcionalidades.
 **/
export const getDropiProductsService = async ( 
  email, 
  password, 
  white_brand_id, 
  keywords, 
  pageSize, 
  startData 
) => {

    try {
      if ( !dropiApi ) {
        // Si aún no hemos autenticado, autenticamos primero
        await authenticateDropi( 
          email, 
          password, 
          white_brand_id
        );
      }
      
      const response = await dropiApi.post('/products/index', {
        keywords: keywords,
        pageSize: pageSize,
        startData: startData
      });

      return response.data;

    } catch (error) {
      console.error('Error fetching Dropi products:', error);
      throw new Error('Failed to fetch Dropi products');
    }
};

//
export const getDropiCategoriesService = async () => {
  try {
    if ( !dropiApi ) {
      // Si aún no hemos autenticado, autenticamos primero
      return "Para obtener las categorias, hay que autenticarse."
    }

    const response = await dropiApi.get('/categories');
    return response.data;

    // Obtener las categorias de dropi
  } catch ( error ) {
    console.error('Error getDropiCategoriesService Dropi:', error);
  }
};