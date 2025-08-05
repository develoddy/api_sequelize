import axios from "axios";
import { Op } from 'sequelize';
import { Product } from "../../../models/Product.js";
import { Categorie } from "../../../models/Categorie.js";
import { sequelize } from '../../../database/database.js';
import { Galeria } from "../../../models/Galeria.js";
import { Variedad } from "../../../models/Variedad.js";
import { ProductVariants } from "../../../models/ProductVariants.js";
import { SaleDetail } from "../../../models/SaleDetail.js";
import { File } from "../../../models/File.js";
import { Option } from "../../../models/Option.js";
import { Cart } from "../../../models/Cart.js";
import {
	authenticateDropi,
	getDropiProductsService,
	getDropiCategoriesService,
} from '../../../services/proveedor/dropi/dropiService.js';

import  { 
  generateSlug,
  downloadImage,
} from "./helper.js";

import fs from 'fs';
import path from "path";

/**/
export const login_dropi = async( req, res ) => {
	try {
		const { email, password, white_brand_id, country } = req.body;

		const token = await authenticateDropi( 
			email, 
			password, 
			white_brand_id, 
			country 
		);

		if( token != null ) {
			const keywords = '', pageSize = 2, startData = 0;
			const data = await getDropiProductsService( 
				email, 
				password, 
				white_brand_id, 
				keywords, 
				pageSize, 
				startData 
			);

			// Procesar los productos antes de enviarlos al cliente
			await processProducts( data );

			return res.status( 200 ).json({ 
				success: true, data 
			});

		} else {
			// Si el token es null, enviamos una respuesta con un código 401 (Unauthorized)
      return res.status(401).json({ 
      	success: false, 
      	message: 'Correo o contraseña incorrectos' 
      });
		}

	} catch( error ) {
		console.error('Error en el login-pe de Dropi:', error.message);
		return res.status(500).json({ 
			success: false, 
			message: 'Error interno del servidor' 
		});
	}
};


/*----- FUNCION PRINCIPAL ------*/
const processProducts = async ( products ) => {
  try {
      let dropiProducts = products;
      if ( dropiProducts ) {
      	for ( const product of dropiProducts.objects ) {
    			await processDropiProduct( product );
      	}
      }
      // return products; // Devuelve los productos procesados (o cualquier otro dato que necesites)
  } catch ( error ) {
    console.error('Error processProducts los productos:', error.message);
  }
};

// 
const processDropiProduct = async ( product ) => {
  try {
  	const category = await getOrCreateCategory(product);
  	const existingProduct = await getOrCreateProduct(product, category);
  } catch ( error ) {
  	console.error('Error processDropiProduct Dropi:', error.message);
  }
};


// Get categories
const getOrCreateCategory = async ( product ) => {

	try {
		for ( const categorie of product.categories ) {
			let existingCategory = await Categorie.findOne({
		    where: { title: categorie.name }
		  });

			if ( !existingCategory ) {
		    existingCategory = await createCategory(categorie);
		  }
		  return existingCategory;
		}
	} catch ( error ) {
		console.error('Error createCategory Dropi:', error.message);
	}
};


// Create category
const createCategory = async (category) => {

	try {
		if ( category.name ) {
			return await Categorie.create({
		    title: category.name,
		    imagen: "tu url imagen Dropi",
		    state: 1,
		  });
		}
	} catch ( error ) {
		console.error('Error createCategory Dropi:', error.message);
	}
};


//
const getOrCreateProduct = async (product, category) => {
	try {
		let existingProduct = await Product.findOne({
  		where: { idProduct: product.id }
  	});

		if ( !existingProduct ) {
			// Create product
			existingProduct = await createProduct(product, category);
		} else {
			// Update product
			// existingProduct = await updateProduct(existingProduct, product, category);
		}

		return existingProduct;

	} catch( error ) {
		console.error('Error Dropi getOrCreateProduct :', error.message);
	}
};


// 
const createProduct = async (product, category) => {
	
	try {

		let portada_name = '';

		let data = {
			idProduct: product.id,
			title: product.name,
			categoryId: category.id,
			price_soles: product.sale_price,
			price_usd: product.sale_price,
			portada: '',
			resumen: 'tu_resumen Dropi',
			description: product.description,
			sku: product.sku,
			slug: await generateSlug(product.name),
			state: 2,
			imagen: 'tu_imagen Dropi',
			type_inventario: 2,
			tags: "",
		};

		if ( product.gallery[0].urlS3 ) {

			// Define la parte fija de la URL
      const baseUrl = 'https://d39ru7awumhhs2.cloudfront.net/';

			var img_path = product.gallery[0].urlS3;
			// espana/products/1113/17101754745_2024-03-11-17-44-33.jpeg

			//var name = img_path.split('/');
			portada_name = img_path;//name[3];
			//portada_name = path.basename(img_path);

			var file_path = path.basename(img_path);

			console.log("Debugg: portada_name: ", portada_name);

			// Construye la URL completa
      const fullImageUrl = baseUrl + portada_name;

      // Guarda solo el nombre del archivo en el campo 'portada' de la base de datos
			data.portada = file_path;

			// Extraer el país de la ruta
      const country = img_path.split('/')[0]; // 'espana' o 'peru'


			const uploadDir = path.resolve('./src/uploads/product');
			// Construir el directorio de destino en el sistema de archivos local, basado en el país
      //const uploadDir = path.resolve('./src/uploads/product', country, path.dirname(portada_name).split('/').slice(1).join('/'));
	    if ( !fs.existsSync( uploadDir ) ) {
	      fs.mkdirSync( uploadDir, { recursive: true } );
	    }

	    //const imagePath = path.join( uploadDir, portada_name );
	    const imagePath = path.join(uploadDir, path.basename(portada_name));

	    await downloadImage(fullImageUrl, imagePath);
		}

		return await Product.create( 
			data 
		);
	} catch ( error ) {
		console.error('Error Dropi createProduct :', error.message);
	}
};


