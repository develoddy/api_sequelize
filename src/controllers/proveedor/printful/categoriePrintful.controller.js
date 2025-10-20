import axios from "axios";
import { Op } from 'sequelize';
import { Product } from "../../../models/Product.js";
import { sequelize } from '../../../database/database.js';

import { 
    getPrintfulCategory,
} from '../../../services/proveedor/printful/printfulService.js'; 

export const getPrintfulCategory = async(categoryId) =>  {
    try {
        const response = await getPrintfulCategory( categoryId );
        return response.result; // Aquí deberías obtener los detalles del producto
    } catch (error) {
        console.error('Error al obtener los detalles del producto:', error);
        throw new Error('Error al obtener los detalles del producto');
    }
  }