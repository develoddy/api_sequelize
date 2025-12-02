import { Sequelize }  from "sequelize";

// Las variables de entorno ya están cargadas por index.js
// NO cargar dotenv aquí para evitar conflictos con PM2

const isDev = process.env.NODE_ENV !== "production";

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
