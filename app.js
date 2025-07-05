import dotEnv from "dotenv";
dotEnv.config(); // Load environment variables first

import express from "express";
import cookieParser from "cookie-parser";
import { corsOptions } from "./config/cors.js"; // This will now have access to environment variables
import router from "./router/router.js";
import cors from "cors";
import compression from "compression";

const app = express();

// Middlewares 
app.use(express.json());
app.use(cors(corsOptions)); 
app.use(cookieParser());
app.use(compression());

// Error-handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    console.log(`${req.method} ${req.url}`);
    res.status(500).json({ message: "Something went wrong!" });
    next();
});

// Router
app.use(router);

export default app;
