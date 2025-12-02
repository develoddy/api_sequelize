import { Sequelize }  from "sequelize";

// Las variables de entorno ya están cargadas por index.js
// NO cargar dotenv aquí para evitar conflictos con PM2

// Inicialización lazy: se crea cuando se accede, no al importar
let sequelizeInstance = null;

function getSequelizeInstance() {
  if (!sequelizeInstance) {
    const isDev = process.env.NODE_ENV !== "production";
    
    sequelizeInstance = new Sequelize(
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
  }
  return sequelizeInstance;
}

// Proxy para que funcione como antes
export const sequelize = new Proxy({}, {
  get(target, prop) {
    return getSequelizeInstance()[prop];
  }
});
