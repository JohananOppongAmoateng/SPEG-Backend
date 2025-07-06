import dotEnv from "dotenv";
dotEnv.config();

export const corsOptions = {
    origin: [process.env.DOMAIN, "http://localhost:5173","http://localhost:5174","https://speg-ecommerce-frontend.onrender.com","https://speg-admin-frontend.onrender.com"], // or a specific URL
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    credentials: true // To allow cookies with CORS
};
