import { Sequelize }  from "sequelize";
import * as dotenv from 'dotenv';
//dotenv.config();

dotenv.config({ path: process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development' });

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
