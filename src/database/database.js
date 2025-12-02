import { Sequelize }  from "sequelize";
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Obtener __dirname en ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development';
const envPath = path.resolve(__dirname, '../..', envFile);
dotenv.config({ path: envPath });

const isDev = process.env.NODE_ENV !== "production";

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
