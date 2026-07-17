import './src/config/env.js';
import { sequelize } from './src/database/database.js';
import { Product } from './src/models/Product.js';
import { Variedad } from './src/models/Variedad.js';
import { File } from './src/models/File.js';
import { ProductVariants } from './src/models/ProductVariants.js';
import { Option } from './src/models/Option.js';
import { Galeria } from './src/models/Galeria.js';

async function checkProductData() {
  try {
    await sequelize.authenticate();
    console.log('✅ Conectado a la base de datos');

    // Buscar producto por slug
    const product = await Product.findOne({
      where: { slug: 'camiseta-dev-code' },
      raw: true
    });

    if (!product) {
      console.log('❌ Producto no encontrado');
      process.exit(1);
    }

    console.log('\n📦 PRODUCTO:');
    console.log(JSON.stringify(product, null, 2));

    // Buscar variedades
    const variedades = await Variedad.findAll({
      where: { productId: product.id },
      raw: true
    });

    console.log('\n📋 VARIEDADES:');
    console.log(JSON.stringify(variedades, null, 2));

    // Buscar Files
    const varietyIds = variedades.map(v => v.id);
    const files = await File.findAll({
      where: { varietyId: varietyIds },
      raw: true
    });

    console.log('\n📁 FILES:');
    console.log(JSON.stringify(files, null, 2));

    // Buscar ProductVariants
    const productVariants = await ProductVariants.findAll({
      where: { product_id: product.id },
      raw: true
    });

    console.log('\n🎨 PRODUCT VARIANTS:');
    console.log(JSON.stringify(productVariants, null, 2));

    // Buscar Options
    const options = await Option.findAll({
      where: { varietyId: varietyIds },
      raw: true
    });

    console.log('\n⚙️ OPTIONS:');
    console.log(JSON.stringify(options, null, 2));

    // Buscar Galerias
    const galerias = await Galeria.findAll({
      where: { productId: product.id },
      raw: true
    });

    console.log('\n🖼️ GALERIAS:');
    console.log(JSON.stringify(galerias, null, 2));

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkProductData();
