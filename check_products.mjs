import dotenv from "dotenv";

// Cargar variables de entorno
dotenv.config({ path: ".env.development" });
import { Product } from "./src/models/Product.js";
import { sequelize } from "./src/database/database.js";

(async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ Conexión a DB establecida");
    
    const products = await Product.findAll({
      attributes: ["id", "title", "slug", "idProduct"],
      where: { state: 2 },
      order: [["createdAt", "DESC"]]
    });
    
    console.log("\n📦 PRODUCTOS EN BASE DE DATOS:");
    console.log("=".repeat(80));
    
    let withPrintfulId = 0;
    let withoutPrintfulId = 0;
    
    products.forEach(product => {
      const hasPrintfulId = product.idProduct ? "✅" : "❌";
      const printfulId = product.idProduct || "SIN PRINTFUL ID";
      
      if (product.idProduct) withPrintfulId++;
      else withoutPrintfulId++;
      
      console.log(`${hasPrintfulId} [${product.id}] ${product.title}`);
      console.log(`    Slug: ${product.slug}`);
      console.log(`    Printful ID: ${printfulId}`);
      console.log("");
    });
    
    console.log("📊 RESUMEN:");
    console.log(`✅ Con Printful ID: ${withPrintfulId}`);
    console.log(`❌ Sin Printful ID: ${withoutPrintfulId}`);
    console.log(`📈 Total: ${products.length}`);
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
})();
