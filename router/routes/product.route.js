import express from "express";
import {
    getAllProducts,
    addProduct,
    getOneProduct,
    updateProduct,
    deleteProduct
} from "../../controllers/product.controller.js";
const router = express.Router();
import { verifyRoles } from "../../middleware/verifyRoles.js";

router.get("/", (req, res) => {
    console.log("the product route has  been hit");
    res.json({
        welcome: "welcome to proudcts of speg inventory management"
    });
});

// this add product to the product model
router.post("/add", addProduct);

// this gets all products from the products model
router.get("/all", getAllProducts);

/*
-this updates a particular product using productId
-this deletes a particular product using productId
-this gets a particular product from the products model
*/
router.get("/:id", getOneProduct);
router.patch("/:id", updateProduct);
router.delete("/:id", deleteProduct);

export default router;
