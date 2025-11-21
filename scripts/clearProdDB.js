import { sequelize } from '../src/database/database.js';
import { User } from '../src/models/User.js';
import { Variedad } from '../src/models/Variedad.js';
import { Slider } from '../src/models/Slider.js';
import { Galeria } from '../src/models/Galeria.js';
import { Categorie } from '../src/models/Categorie.js';
import { Product } from '../src/models/Product.js';
import { Sale } from '../src/models/Sale.js';
import { Shipment } from '../src/models/Shipment.js';
import { SaleDetail } from '../src/models/SaleDetail.js';
import { SaleAddress } from '../src/models/SaleAddress.js';
import { Review } from '../src/models/Review.js';
import { DiscountCategorie } from '../src/models/DiscountCategorie.js';
import { DiscountProduct } from '../src/models/DiscountProduct.js';
import { Discount } from '../src/models/Discount.js';
import { CuponeCategorie } from '../src/models/CuponeCategorie.js';
import { CuponeProduct } from '../src/models/CuponeProduct.js';
import { Cupone } from '../src/models/Cupone.js';
import { Cart } from '../src/models/Cart.js';
import { CartCache } from '../src/models/CartCache.js';
import { CheckoutCache } from '../src/models/CheckoutCache.js';
import { Wishlist } from '../src/models/Wishlist.js';
import { AddressClient } from '../src/models/AddressClient.js';
import { AddressGuest } from '../src/models/AddressGuest.js';
import { ProductVariants } from '../src/models/ProductVariants.js';
import { File } from '../src/models/File.js';
import { Option } from '../src/models/Option.js';
import { ReturnRequest } from '../src/models/ReturnRequest.js';
import { Notification } from '../src/models/Notification.js';
import { Inbox } from '../src/models/Inbox.js';
import { Guest } from '../src/models/Guest.js';
import { Receipt } from '../src/models/Receipt.js';

async function clearProdDB() {
  try {
    console.log("🔥 Limpieza de producción: borrando todos los registros...");

    // Orden importante para evitar errores de foreign keys
    
    // 1. Limpiar tablas dependientes primero
    console.log("📊 Limpiando SaleDetails...");
    await SaleDetail.destroy({ where: {} });
    
    console.log("📧 Limpiando SaleAddresses...");
    await SaleAddress.destroy({ where: {} });
    
    console.log("🛒 Limpiando Sales...");
    await Sale.destroy({ where: {} });
    
    console.log("📦 Limpiando Shipments...");
    await Shipment.destroy({ where: {} });
    
    console.log("🧾 Limpiando Receipts...");
    await Receipt.destroy({ where: {} });

    // 2. Cupones y descuentos
    console.log("🎟️ Limpiando Cupones y Descuentos...");
    await CuponeProduct.destroy({ where: {} });
    await CuponeCategorie.destroy({ where: {} });
    await Cupone.destroy({ where: {} });
    await DiscountProduct.destroy({ where: {} });
    await DiscountCategorie.destroy({ where: {} });
    await Discount.destroy({ where: {} });

    // 3. Carritos, wishlist, direcciones
    console.log("🛍️ Limpiando Carritos y Wishlist...");
    await Cart.destroy({ where: {} });
    await CartCache.destroy({ where: {} });
    await CheckoutCache.destroy({ where: {} });
    await Wishlist.destroy({ where: {} });
    await AddressClient.destroy({ where: {} });
    await AddressGuest.destroy({ where: {} });

    // 4. Reviews y notificaciones
    console.log("⭐ Limpiando Reviews y Notificaciones...");
    await Review.destroy({ where: {} });
    await Notification.destroy({ where: {} });
    await Inbox.destroy({ where: {} });
    await ReturnRequest.destroy({ where: {} });

    // 5. Productos y variantes
    console.log("📦 Limpiando Productos...");
    await ProductVariants.destroy({ where: {} });
    await Galeria.destroy({ where: {} });
    await Variedad.destroy({ where: {} });
    await Product.destroy({ where: {} });

    // 6. Archivos, opciones, categorías
    console.log("🗂️ Limpiando Archivos y Categorías...");
    await File.destroy({ where: {} });
    await Option.destroy({ where: {} });
    await Slider.destroy({ where: {} });
    await Categorie.destroy({ where: {} });

    // 7. Usuarios y guests (al final)
    console.log("👥 Limpiando Usuarios...");
    await Guest.destroy({ where: {} });
    await User.destroy({ where: {} });

    console.log("✅ Producción limpia exitosamente - todas las tablas vacías");
    console.log("🏗️ Estructura de base de datos intacta");

  } catch (error) {
    console.error("❌ Error limpiando DB producción:", error);
    console.error("Stack trace:", error.stack);
  } finally {
    console.log("🔌 Cerrando conexión a base de datos...");
    await sequelize.close();
    console.log("✅ Script completado");
    process.exit(0);
  }
}

clearProdDB();
