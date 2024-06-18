import app from './app.js';
import { sequelize } from "./database/database.js";
import * as dotenv from 'dotenv';
dotenv.config();

import './models/User.js';
import './models/Slider.js';
import './models/Galeria.js';
import './models/Categorie.js';
import './models/Product.js';
import './models/Variedad.js';
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
import './models/AddressClient.js';

// New
import './models/ProductVariants.js';
import './models/File.js';
import './models/Option.js';
//import './models/Value.js';


async function main() {
    try {
        await sequelize.sync({ force: true });
        app.listen( 3500 )
        console.log("Server running on port 35000");
    } catch (error) {
        console.error('Unable to connect to the database: :(', error);
    }
}

main();
