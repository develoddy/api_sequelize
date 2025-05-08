import {
 getPrintfulShippingRatesService,
} from '../../../services/proveedor/printful/printfulService.js';


export const getShippingRates = async( payload ) => {
  try{
    const shippingRates = await getPrintfulShippingRatesService(payload);
    return shippingRates;
    //res.status( 200 ).json({
    //    shippingRates: shippingRates,
    //});
  } catch {
    console.error('Error al calcular Shipping Rates:', error);
    throw new Error('Error al calcular Shipping Rates');
  }
}