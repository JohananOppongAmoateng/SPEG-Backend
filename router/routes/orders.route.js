import { Router } from "express";
import {
  createOrder,
  getAllOrders,
  getOrderById,
  getOrdersByFarmerId,
  getPendingOrdersCount,
  updateOrder,
  updateOrderStatusToPaid,
  getPendingInvoices,
} from "../../controllers/orders.controller.js";
const router = Router();

// Order routes
router.patch("/:orderId/status", updateOrderStatusToPaid);
router.get("/pending-count", getPendingOrdersCount);
router.post("/create", createOrder); // Create a new order

router.get("/all", getAllOrders); // Get all orders
router.get("/user/:farmerId", getOrdersByFarmerId);
router.get("/:orderId", getOrderById); // Get order details by order ID

router.patch("/:orderId", updateOrder);

router.get("/pending/invoices", getPendingInvoices);

export default router;
