import './src/config/env.js';

async function fetchProduct(slug) {
  try {
    const response = await fetch(`http://localhost:3000/api/products/show_landing_product/${slug}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error fetching ${slug}:`, error.message);
    return null;
  }
}

async function main() {
  // Producto afectado
  console.log('🔴 PRODUCTO AFECTADO: camiseta-dev-code');
  console.log('='.repeat(80));
  const brokenProduct = await fetchProduct('camiseta-dev-code');
  if (brokenProduct) {
    console.log(JSON.stringify(brokenProduct, null, 2));
  }

  console.log('\n\n');

  // Producto que funciona (obtener uno de la lista)
  console.log('🟢 PRODUCTO QUE FUNCIONA: (necesito slug de un producto que funcione)');
  console.log('='.repeat(80));
  
  // Intentar obtener lista de productos para comparar
  const listResponse = await fetch('http://localhost:3000/api/products/list_products_all');
  const listData = await listResponse.json();
  
  // Buscar un producto con variedades que no sea camiseta-dev-code
  const workingProduct = listData.data.find(p => 
    p.slug !== 'camiseta-dev-code' && 
    p.variedades && 
    p.variedades.length > 0
  );
  
  if (workingProduct) {
    console.log(`📦 Usando producto: ${workingProduct.slug}`);
    const workingDetail = await fetchProduct(workingProduct.slug);
    if (workingDetail) {
      console.log(JSON.stringify(workingDetail, null, 2));
    }
  }
}

main().then(() => process.exit(0)).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
