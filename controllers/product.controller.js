import prisma from "../utils/prisma.js";

// Add a New Product to the Inventory
export async function addProduct(req, res) {
  try {
    const { productName, stockKeepingUnit, reOrderLevel } = req.body;

    // Check if the product already exists
    const existingProduct = await prisma.product.findFirst({
      where: {
        productName : productName
      }
    }
    );
    if (existingProduct) {
      return res
        .status(400)
        .json({ message: "Product already exists in the inventory." });
    }

    // Create a new product
    const newProduct = await prisma.product.create({
      data: {
        productName,
      stockKeepingUnit,
      reOrderLevel    
      }
    }
    )

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

    const allProducts = await prisma.product.findMany({
      include: {
      transactions: true,
      },
    });
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

    const product = await prisma.product.findUnique({
      where: {
        id: id
      }
    }); // Assuming id is a unique identifier

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
    const updatedProduct = await prisma.product.update({
        where: {
          id: id
        },
        data : body
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
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ message: "Please provide product id" });
    }

    // Check if the product has associated orderProducts using include
    const product = await prisma.product.findUnique({
      where: {
        id: id,
      },
      include: {
        orderProducts: true,
      },
    });

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    if (product.orderProducts.length > 0) {
      return res.status(400).json({
        message: "Cannot delete product. There are associated orderProducts.",
      });
    }

    await prisma.product.delete({
      where: {
        id: id,
      },
    });

    res.status(200).json({
      message: "Product deleted successfully",
    });
  } catch (error) {
    res.status(500).json({ message: "Error deleting product", error });
  }
}

//delete transaction made on a product
