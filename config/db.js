// config/db.js
import { Sequelize } from "sequelize";
import dotenv from "dotenv";
dotenv.config();

 
export const sequelize = new Sequelize(process.env.POSTGRES_URL,{
    dialect: "postgres", 
    dialectOptions: {
        ssl: {
            require: true,
        },
    }
});

export const connectPostgres = async () => {
    try {
        await sequelize.authenticate();
        console.log("PostgreSQL connected successfully!");
    } catch (err) {
        console.error("PostgreSQL connection error:", err);
    }
};

