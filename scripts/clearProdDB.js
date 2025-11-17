import { sequelize } from './database/database.js';
import './models/User.js';
import './models/Variedad.js';
import './models/Slider.js';
import './models/Galeria.js';
import './models/Categorie.js';
import './models/Product.js';
import './models/Sale.js';
import './models/Shipment.js';
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
import './models/CartCache.js';
import './models/Wishlist.js';
import './models/AddressClient.js';
import './models/AddressGuest.js';
import './models/ProductVariants.js';
import './models/File.js';
import './models/Option.js';
import './models/chat/ChatConversation.js';
import './models/chat/ChatMessage.js';
import './models/ReturnRequest.js';
import './models/Notification.js';

async function clearProdDB() {
  try {
    console.log("🔥 Limpieza de producción: borrando todos los registros...");

    // Tablas principales
    await SaleDetail.destroy({ where: {}, truncate: true });
    await SaleAddress.destroy({ where: {}, truncate: true });
    await Sale.destroy({ where: {}, truncate: true });
    await Shipment.destroy({ where: {}, truncate: true });

    // Cupones y descuentos
    await CuponeProduct.destroy({ where: {}, truncate: true });
    await CuponeCategorie.destroy({ where: {}, truncate: true });
    await Cupone.destroy({ where: {}, truncate: true });
    await DiscountProduct.destroy({ where: {}, truncate: true });
    await DiscountCategorie.destroy({ where: {}, truncate: true });
    await Discount.destroy({ where: {}, truncate: true });

    // Carritos, wishlist, direcciones
    await Cart.destroy({ where: {}, truncate: true });
    await CartCache.destroy({ where: {}, truncate: true });
    await Wishlist.destroy({ where: {}, truncate: true });
    await AddressClient.destroy({ where: {}, truncate: true });
    await AddressGuest.destroy({ where: {}, truncate: true });

    // Productos y variantes
    await ProductVariants.destroy({ where: {}, truncate: true });
    await Product.destroy({ where: {}, truncate: true });

    // Archivos, opciones, galerías, sliders
    await File.destroy({ where: {}, truncate: true });
    await Option.destroy({ where: {}, truncate: true });
    await Galeria.destroy({ where: {}, truncate: true });
    await Slider.destroy({ where: {}, truncate: true });
    await Categorie.destroy({ where: {}, truncate: true });
    await Variedad.destroy({ where: {}, truncate: true });

    // Chats y notificaciones
    await ChatMessage.destroy({ where: {}, truncate: true });
    await ChatConversation.destroy({ where: {}, truncate: true });
    await Notification.destroy({ where: {}, truncate: true });

    // Usuarios
    await User.destroy({ where: {}, truncate: true });

    console.log("✅ Producción limpia, todas las tablas vacías (estructura intacta)");

  } catch (error) {
    console.error("❌ Error limpiando DB producción:", error);
  } finally {
    await sequelize.close();
  }
}

clearProdDB();
