import { Router } from "express";
import {
  deleteTransaction,
  issueProduct,
  restockProduct,
  updatePickup,
} from "../../controllers/transactions.controller.js";

const router = Router();

router.get("/", (req, res) => {
  console.log("The product route has been hit");
  res.status(200).json({
    welcome: "Welcome to transactions of Speg inventory management",
  });
});

// Add product to the product model
router.delete("/:transactionId/product/:productId", deleteTransaction);
router.post("/issue/:id", issueProduct);
router.patch("/issue/:id", updatePickup);
router.post("/restock/:id", restockProduct);

export default router;
