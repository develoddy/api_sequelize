import { sequelize } from '../src/database/database.js';

async function testConnection() {
  try {
    console.log("🔍 Probando conexión a base de datos...");
    console.log("Configuración:");
    console.log("  Host:", sequelize.config.host || 'localhost');
    console.log("  Puerto:", sequelize.config.port || 3306);
    console.log("  BD:", sequelize.config.database);
    console.log("  Usuario:", sequelize.config.username);
    
    await sequelize.authenticate();
    console.log("✅ Conexión exitosa!");
    
    // Ver tablas disponibles
    const [results] = await sequelize.query("SHOW TABLES");
    console.log("📊 Tablas encontradas:", results.length);
    
  } catch (error) {
    console.error("❌ Error de conexión:", error.message);
    console.log("\n🔧 Posibles soluciones:");
    console.log("1. Verificar que MySQL esté corriendo: systemctl status mysql");
    console.log("2. Verificar configuración en .env o database.js");
    console.log("3. Verificar firewall/puertos: netstat -tlnp | grep 3306");
  } finally {
    await sequelize.close();
    process.exit(0);
  }
}

testConnection();