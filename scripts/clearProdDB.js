import { sequelize } from '../src/database/database.js';
import '../src/models/User.js';
import '../src/models/Variedad.js';
import '../src/models/Slider.js';
import '../src/models/Galeria.js';
import '../src/models/Categorie.js';
import '../src/models/Product.js';
import '../src/models/Sale.js';
import '../src/models/Shipment.js';
import '../src/models/SaleDetail.js';
import '../src/models/SaleAddress.js';
import '../src/models/Review.js';
import '../src/models/DiscountCategorie.js';
import '../src/models/DiscountProduct.js';
import '../src/models/Discount.js';
import '../src/models/CuponeCategorie.js';
import '../src/models/CuponeProduct.js';
import '../src/models/Cupone.js';
import '../src/models/Cart.js';
import '../src/models/CartCache.js';
import '../src/models/Wishlist.js';
import '../src/models/AddressClient.js';
import '../src/models/AddressGuest.js';
import '../src/models/ProductVariants.js';
import '../src/models/File.js';
import '../src/models/Option.js';
import '../src/models/chat/ChatConversation.js';
import '../src/models/chat/ChatMessage.js';
import '../src/models/ReturnRequest.js';
import '../src/models/Notification.js';

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
