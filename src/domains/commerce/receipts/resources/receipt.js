// Las variables de entorno ya están cargadas por index.js

export default {

  receipt_item: (receipt) => {

    if (!receipt) return {};

    const sale = receipt.sale || {};
    const guest = receipt.guest || {};
    const user = receipt.user || null;

     //console.log('Receipt sale_details:', sale.sale_details);
    //console.log("Receipt sale_details", JSON.stringify(sale.sale_details, null, 2));

    const saleDetails = (sale.sale_details || []).map(detail => ({
      id: detail.id,
      cantidad: detail.cantidad,
      subtotal: detail.subtotal,
      total: detail.total,
      price_unitario: detail.price_unitario,
      product: detail.product ? {
        id: detail.product.id,
        title: detail.product.title,
        slug: detail.product.slug,
        imagen: process.env.URL_BACKEND + '/api/products/uploads/product/' + detail.product.portada,
        price_eur: detail.product.price_usd, // Unified price in EUR
        price: detail.product.price_usd, // Alias for consistency
        currency: 'EUR',
        price_usd: detail.product.price_usd, // Legacy - deprecated
        price_soles: detail.product.price_soles, // Legacy - deprecated
        sku: detail.product.sku
      } : null,
      variedad: detail.variedade ? {
        id: detail.variedade.id,
        valor: detail.variedade.valor,
        color: detail.variedade.color,
        sku: detail.variedade.sku,
        retail_price: detail.variedade.retail_price,
        currency: detail.variedade.currency,
        files: (detail.variedade.files || []).map(f => ({
          id: f.id,
          url: f.url,
          preview_url: f.preview_url,
          thumbnail_url: f.thumbnail_url,
          filename: f.filename,
          type: f.type,
          mime_type: f.mime_type
        }))
      } : null
    }));

    // Sale Addresses
    const saleAddresses = (sale.sale_addresses || []).map(addr => ({
      id: addr.id,
      name: addr.name,
      lastname: addr.surname,
      email: addr.email,
      phone: addr.telefono,
      country: addr.pais,
      city: addr.ciudad,
      state: addr.region,
      address: addr.address,
      referencia: addr.referencia,
      nota: addr.nota,
      zipcode: addr.zipcode
    }));

    return {
      id: receipt.id,
      amount: receipt.amount,
      paymentMethod: receipt.paymentMethod,
      paymentDate: receipt.paymentDate,
      status: receipt.status,
      notes: receipt.notes,
      createdAt: receipt.createdAt,
      updatedAt: receipt.updatedAt,

      user: user ? {
        id: user.id,
        name: user.name,
        email: user.email
      } : null,

      guest: guest ? {
        id: guest.id,
        name: guest.name,
        email: guest.email,
        phone: guest.phone,
        zipcode: guest.zipcode,
      } : null,

      sale: sale ? {
        id: sale.id,
        total: sale.total,
        minDeliveryDate: sale.minDeliveryDate,
        maxDeliveryDate: sale.maxDeliveryDate,
        printfulOrderId: sale.printfulOrderId,
        printfulStatus: sale.printfulStatus,
        sale_details: saleDetails,
        saleAddresses: saleAddresses
      } : null
    };
  }

};
