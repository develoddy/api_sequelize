import axios from 'axios';

// Configuración de Printful API
const PRINTFUL_API_TOKEN = process.env.PRINTFUL_API_TOKEN;

const printfulApi = axios.create({
  baseURL: 'https://api.printful.com',
  headers: {
    'Authorization': `Bearer ${PRINTFUL_API_TOKEN}`,
    'Content-Type': 'application/json'
  },
  timeout: 30000
});

/**
 * POST /api/printful/shipping/rates
 * Calcula tarifas de envío para una orden
 * 
 * Body esperado:
 * {
 *   recipient: {
 *     country_code: "ES",
 *     state_code: null,
 *     city: "Madrid",
 *     zip: "28001"
 *   },
 *   items: [
 *     { variant_id: 11548, quantity: 2 }
 *   ]
 * }
 */
export const calculateShippingRates = async (req, res) => {
  try {
    const { recipient, items } = req.body;

    // Validación
    if (!recipient || !recipient.country_code) {
      return res.status(400).json({
        success: false,
        message: 'El código de país es requerido (country_code)'
      });
    }

    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Debe incluir al menos un producto (items)'
      });
    }

    console.log('📦 Calculating shipping rates for:', recipient.country_code);

    // Llamar a Printful API para calcular tarifas
    const response = await printfulApi.post('/shipping/rates', {
      recipient: recipient,
      items: items
    });

    if (!response.data || !response.data.result) {
      return res.status(404).json({
        success: false,
        message: 'No se pudieron calcular las tarifas de envío'
      });
    }

    const rates = response.data.result;

    // Enriquecer con información adicional
    const enrichedRates = rates.map(rate => ({
      ...rate,
      // Agregar etiquetas legibles
      speed_label: getSpeedLabel(rate.id),
      recommended: rate.id === 'STANDARD', // STANDARD como recomendado por defecto
      // Calcular días estimados promedio
      estimated_days_avg: rate.minDeliveryDays && rate.maxDeliveryDays 
        ? Math.round((rate.minDeliveryDays + rate.maxDeliveryDays) / 2)
        : null,
      // Formatear descripción más clara
      description_es: translateDescription(rate.name)
    }));

    // Ordenar por velocidad (más rápido primero)
    enrichedRates.sort((a, b) => {
      const speedOrder = { 'PRIORITY': 1, 'EXPRESS': 2, 'STANDARD': 3, 'ECONOMY': 4 };
      return (speedOrder[a.id] || 999) - (speedOrder[b.id] || 999);
    });

    console.log(`✅ Shipping rates calculated: ${enrichedRates.length} options`);

    return res.status(200).json({
      success: true,
      rates: enrichedRates,
      summary: {
        cheapest: findCheapest(enrichedRates),
        fastest: findFastest(enrichedRates),
        recommended: enrichedRates.find(r => r.recommended) || enrichedRates[0]
      }
    });

  } catch (error) {
    console.error('❌ Error calculating shipping rates:', error.response?.data || error.message);
    
    return res.status(500).json({
      success: false,
      message: 'Error al calcular tarifas de envío',
      error: error.response?.data?.error?.message || error.message
    });
  }
};

/**
 * GET /api/printful/shipping/countries
 * Obtiene lista de países disponibles para envío
 */
export const getShippingCountries = async (req, res) => {
  try {
    console.log('🌍 Fetching available shipping countries...');

    const response = await printfulApi.get('/countries');

    if (!response.data || !response.data.result) {
      return res.status(404).json({
        success: false,
        message: 'No se pudieron obtener los países'
      });
    }

    const countries = response.data.result;

    console.log(`✅ Countries fetched: ${countries.length} available`);

    return res.status(200).json({
      success: true,
      countries: countries
    });

  } catch (error) {
    console.error('❌ Error fetching countries:', error.response?.data || error.message);
    
    return res.status(500).json({
      success: false,
      message: 'Error al obtener países',
      error: error.response?.data?.error?.message || error.message
    });
  }
};

/**
 * GET /api/printful/shipping/countries/:code/states
 * Obtiene estados/provincias de un país específico
 */
export const getCountryStates = async (req, res) => {
  try {
    const { code } = req.params;

    console.log(`🗺️ Fetching states for country: ${code}...`);

    const response = await printfulApi.get(`/countries/${code}`);

    if (!response.data || !response.data.result) {
      return res.status(404).json({
        success: false,
        message: 'No se encontró información del país'
      });
    }

    const countryData = response.data.result;
    const states = countryData.states || [];

    console.log(`✅ States fetched: ${states.length} for ${code}`);

    return res.status(200).json({
      success: true,
      country: countryData,
      states: states
    });

  } catch (error) {
    const { code } = req.params; // Recuperar code del request
    
    // Si el error es 404, significa que el país no tiene estados/provincias
    // Esto es normal para países como España, Francia, etc.
    if (error.response?.data?.code === 404) {
      console.log(`ℹ️ Country ${code} has no states/provinces (this is normal)`);
      return res.status(200).json({
        success: true,
        country: { code },
        states: []
      });
    }

    console.error('❌ Error fetching country states:', error.response?.data || error.message);
    
    return res.status(500).json({
      success: false,
      message: 'Error al obtener estados del país',
      error: error.response?.data?.error?.message || error.message
    });
  }
};

/**
 * Helper: Etiqueta de velocidad en español
 */
function getSpeedLabel(shippingId) {
  const labels = {
    'PRIORITY': '⚡ Prioritario',
    'EXPRESS': '🚀 Express',
    'STANDARD': '📦 Estándar',
    'ECONOMY': '💰 Económico'
  };
  return labels[shippingId] || shippingId;
}

/**
 * Helper: Traducir descripción al español
 */
function translateDescription(name) {
  const translations = {
    'Priority': 'Entrega Prioritaria',
    'Express': 'Entrega Express',
    'Standard': 'Entrega Estándar',
    'Economy': 'Entrega Económica',
    'Flat Rate': 'Tarifa Plana',
    'business days': 'días laborables',
    'after fulfillment': 'después de producción'
  };
  
  let translated = name;
  Object.keys(translations).forEach(key => {
    translated = translated.replace(new RegExp(key, 'gi'), translations[key]);
  });
  
  return translated;
}

/**
 * Helper: Encontrar tarifa más barata
 */
function findCheapest(rates) {
  if (!rates || rates.length === 0) return null;
  return rates.reduce((min, rate) => 
    parseFloat(rate.rate) < parseFloat(min.rate) ? rate : min
  );
}

/**
 * Helper: Encontrar tarifa más rápida
 */
function findFastest(rates) {
  if (!rates || rates.length === 0) return null;
  return rates.reduce((min, rate) => {
    const minDays = min.minDeliveryDays || 999;
    const rateDays = rate.minDeliveryDays || 999;
    return rateDays < minDays ? rate : min;
  });
}
