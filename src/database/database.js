import { Sequelize }  from "sequelize";

export const sequelize = new Sequelize( 'ecommercedb', 'root', '', {
    host: "localhost",
    dialect: "mysql",
    define: {
          timestamps: false,
    },
})