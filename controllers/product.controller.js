import { Product } from "../models/modelSchema.js";

// Add a New Product to the Inventory
export async function addProduct(req, res) {
  try {
    const { productName, stockKeepingUnit, reOrderLevel } = req.body;

    // Check if the product already exists
    const existingProduct = await Product.findOne({ productName });
    if (existingProduct) {
      return res
        .status(400)
        .json({ message: "Product already exists in the inventory." });
    }

    // Create a new product
    const newProduct = new Product({
      productName,
      stockKeepingUnit,
      reOrderLevel,
      transactions: [], // Initially, no transactions are recorded
    });

    // Save the new product to the database
    await newProduct.save();

    res.status(201).json({
      message: "Product added successfully",
      product: newProduct,
    });
  } catch (error) {
    res.status(500).json({ message: "Error adding product", error });
  }
}

// Get all products
export async function getAllProducts(req, res) {
  try {
    console.log("product route has been hit");

    const allProducts = await Product.find();
    res.status(200).json({ product: allProducts }); // Use 200 for successful GET requests
  } catch (error) {
    res.status(500).json({ message: "Error getting all products", error });
  }
}

// Get one product
export async function getOneProduct(req, res) {
  try {
    // Ensure your connection works properly
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ message: "Please provide product id" });
    }

    const product = await Product.findById(id); // Assuming id is a unique identifier

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.status(200).json({ product });
  } catch (error) {
    res.status(500).json({ message: "Error getting product", error });
  }
}

// Update a product
export async function updateProduct(req, res) {
  try {
    // Ensure you're waiting for the connection to complete

    const { id } = req.params;
    const body = req.body; // Use req.body to get the request data

    if (!id) {
      return res.status(400).json({ message: "Please provide product id" });
    }

    const updatedProduct = await Product.findByIdAndUpdate(id, body, {
      new: true, // Returns the updated product
    });

    if (!updatedProduct) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.status(200).json({
      message: "Product updated successfully",
      product: updatedProduct,
    });
  } catch (error) {
    res.status(500).json({ message: "Error updating product", error });
  }
}

// Delete a product
export async function deleteProduct(req, res) {
  try {
    // Added await for the database connection
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ message: "Please provide product id" });
    }

    const deletedProduct = await Product.findByIdAndDelete(id); // Added await

    if (!deletedProduct) {
      return res.status(404).json({ message: "Product not found" }); // Use 404 for not found
    }

    res.status(200).json({
      message: "Product deleted successfully",
    });
  } catch (error) {
    res.status(500).json({ message: "Error deleting product", error });
  }
}

//delete transaction made on a product
