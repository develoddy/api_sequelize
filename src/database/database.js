import { Sequelize }  from "sequelize";

// Las variables de entorno ya están cargadas por env.js
// NO cargar dotenv aquí para evitar conflictos con PM2

// Validar que las variables estén cargadas
if (!process.env.DB_NAME || !process.env.DB_HOST) {
  console.error('❌ [database.js] Variables de entorno NO cargadas');
  console.error(`DB_NAME: ${process.env.DB_NAME || 'UNDEFINED'}`);
  console.error(`DB_HOST: ${process.env.DB_HOST || 'UNDEFINED'}`);
  throw new Error('Variables de entorno no disponibles. Asegúrate de que env.js se carga primero.');
}

const isDev = process.env.NODE_ENV !== "production";

console.error(`✅ [database.js] Creando conexión a: ${process.env.DB_HOST}/${process.env.DB_NAME}`);

// Inicialización directa - las variables ya están disponibles cuando se importa este módulo
export const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    dialect: process.env.DB_DIALECT || "mysql",
    logging: isDev ? console.log : false, // Logging solo en dev
    define: {
      timestamps: false,
    },
  }
);
