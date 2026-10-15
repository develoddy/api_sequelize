const path = require('path');
const dotenv = require('dotenv');

dotenv.config({
    path: path.resolve(
        __dirname,
        process.env.NODE_ENV === 'production'
            ? '../.env.production'
            : '../.env.development'
    ),
});

function getConfig() {
    const database = process.env.EXPERIMENTS_DB_NAME;
    const primaryDatabase = process.env.DB_NAME;

    if (!database || !primaryDatabase || database === primaryDatabase) {
        throw new Error(
            '[experiments.config] La base de experimentos debe estar configurada y ser distinta de DB_NAME.'
        );
    }

    return {
        username: process.env.EXPERIMENTS_DB_USER || process.env.DB_USER,
        password: process.env.EXPERIMENTS_DB_PASSWORD ?? process.env.DB_PASSWORD,
        database,
        host: process.env.EXPERIMENTS_DB_HOST || process.env.DB_HOST,
        dialect: process.env.EXPERIMENTS_DB_DIALECT || process.env.DB_DIALECT || 'mysql',
        logging: false,
    };
}

const environment = process.env.NODE_ENV === 'production'
    ? 'production'
    : 'development';

module.exports = {
    [environment]: getConfig(),
};
