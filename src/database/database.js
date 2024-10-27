import { Sequelize }  from "sequelize";

export const sequelize = new Sequelize( 'ecommercedb', 'lujandev', '$$Sistemas201290', {
    host: "mysql-8001.dinaserver.com",
    dialect: "mysql",
    define: {
          timestamps: false,
    },
})
