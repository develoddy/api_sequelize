import { Sequelize } from 'sequelize';

// Las variables de entorno deben estar cargadas previamente por env.js.
const database = process.env.EXPERIMENTS_DB_NAME;
const host = process.env.EXPERIMENTS_DB_HOST || process.env.DB_HOST;
const username = process.env.EXPERIMENTS_DB_USER || process.env.DB_USER;
const password = process.env.EXPERIMENTS_DB_PASSWORD ?? process.env.DB_PASSWORD;

if (!database || !host || !username || password === undefined) {
    throw new Error(
        '[experiments.database.js] Configuración MySQL de experimentos incompleta.'
    );
}

if (database === process.env.DB_NAME) {
    throw new Error(
        '[experiments.database.js] La base de experimentos debe ser distinta de DB_NAME.'
    );
}

export const experimentsSequelize = new Sequelize(
    database,
    username,
    password,
    {
        host,
        dialect: process.env.EXPERIMENTS_DB_DIALECT || process.env.DB_DIALECT || 'mysql',
        logging: false,
        define: {
            timestamps: false,
        },
    }
);
