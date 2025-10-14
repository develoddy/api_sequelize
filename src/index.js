import app from './app.js';
import { sequelize } from "./database/database.js";
import * as dotenv from 'dotenv';
dotenv.config();

import './models/User.js';
import './models/Variedad.js';
import './models/Slider.js';
import './models/Galeria.js';
import './models/Categorie.js';
import './models/Product.js';
import './models/Sale.js';
import './models/SaleDetail.js';
import './models/SaleAddress.js';
import './models/Review.js';
import './models/DiscountCategorie.js';
import './models/DiscountProduct.js';
import './models/Discount.js';
import './models/CuponeCategorie.js';
import './models/CuponeProduct.js';
import './models/Cupone.js';
import './models/Cart.js';
import './models/CartCache.js'; // Cart Guest
import './models/Wishlist.js';
import './models/AddressClient.js';
import './models/AddressGuest.js'; // Address Guest
import './models/ProductVariants.js';
import './models/File.js';
import './models/Option.js';

// Importar las asociaciones aquí
import './models/Associations.js';

async function main() {
    try {
        await sequelize.sync({ force: false });
        //await sequelize.sync({ alter: true }); // Esto actualiza la tabla sin borrar datos:
        const PORT = 3500;
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    } catch (error) {
        console.error('Unable to connect to the database: :(', error);
    }
}

main();
