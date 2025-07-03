import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import orderRoute from "../router/routes/orders.route.js";
import usersRoute from "../router/routes/users.route.js";
import transactionRoute from "../router/routes/transaction.route.js";
import productRoute from "../router/routes/product.route.js";
import invoiceRoute from "../router/routes/invoice.route.js";
import { verifyToken } from "../middleware/verifyToken.js";


const route = express();

// Get the directory name using ES modules approach
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define the path to invoices directory - move up one level since we're likely in src/
const invoicesPath = path.join(__dirname, '..', 'public', 'invoices');

// Serve static files for invoices
route.use('/api/invoices/files', express.static(invoicesPath));

// API routes
route.use("/api/users", usersRoute);
route.use("/api/products", productRoute);
route.use("/api/transactions", transactionRoute);
route.use("/api/orders", orderRoute);
route.use("/api/invoices", invoiceRoute);

// Optionally apply verifyToken middleware to all routes that need authentication
// route.use(verifyToken); // Uncomment and move this up before protected routes if needed

export default route;