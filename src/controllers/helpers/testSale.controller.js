import { Sale } from '../../models/Sale.js';
import { SaleAddress } from '../../models/SaleAddress.js';
import { SaleDetail } from '../../models/SaleDetail.js';

/**
 * Endpoint temporal para crear Sale de prueba completo
 */
export const createTestSale = async (req, res) => {
  try {
    // Crear Sale
    const sale = await Sale.create({
      method_payment: 'stripe',
      n_transaction: `TEST_AUTO_SYNC_${Date.now()}`,
      total: 45.95,
      currency_payment: 'EUR',
      curreny_total: 'EUR',
      price_dolar: 0,
      syncStatus: 'pending'
    });

    // Crear SaleAddress
    await SaleAddress.create({
      saleId: sale.id,
      name: 'John Doe Test',
      surname: 'Doe',
      email: 'test@example.com',
      telefono: '+34612345678',
      pais: 'ES',
      region: 'Madrid',
      address: 'Calle Test 123',
      referencia: 'Cerca del parque',
      ciudad: 'Madrid',
      provincia: 'MD',
      zipcode: '28001'
    });

    // Crear SaleDetail con producto válido (variant_id 14226 = Unisex Staple T-Shirt)
    await SaleDetail.create({
      saleId: sale.id,
      productId: 1, // Debe existir en tu DB
      variedadId: 1, // Debe tener variant_id = 14226
      cantidad: 1,
      price_unitario: 45.95,
      subtotal: 45.95,
      total: 45.95,
      discount: 0,
      type_discount: 1,
      type_campaign: null,
      code_cupon: null,
      code_discount: null
    });

    return res.status(201).json({
      success: true,
      message: 'Sale de prueba creado',
      saleId: sale.id,
      n_transaction: sale.n_transaction
    });

  } catch (error) {
    console.error('❌ Error creando Sale de prueba:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al crear Sale de prueba',
      error: error.message
    });
  }
};
