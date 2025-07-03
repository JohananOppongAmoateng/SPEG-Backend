import { Invoice, Order, User } from "../models/modelSchema.js";
import { Product } from "../models/modelSchema.js";
import { createInvoice } from "./invoice.controller.js";
import axios from "axios";

// Create a new Order
export async function createOrder(req, res) {
  try {
    const { farmerId, products } = req.body;
    const orderProducts = [];
    let totalCost = 0;

    for (const product of products) {
      const productDetails = await Product.findById(product.productId);
      if (!productDetails) {
        return res.status(404).json({
          message: `Product with ID ${product.productId} not found`,
        });
      }

      if (product.quantity > productDetails.availableStock) {
        return res.status(400).json({
          message: `Insufficient stock for ${productDetails.productName}`,
        });
      }

      const cost = product.quantity * productDetails.sellingPrice;
      totalCost += cost;
      orderProducts.push({
        productId: product.productId,
        productName: productDetails.productName,
        quantity: product.quantity,
        unitPrice: productDetails.sellingPrice,
        cost: cost,
      });
    }

    const newOrder = new Order({
      farmerId,
      products: orderProducts,
      orderStatus: "Pending",
      paymentStatus: "Pending",
      totalCost: totalCost,
    });

    await newOrder.save();
    res
      .status(201)
      .json({ message: "Order created successfully", order: newOrder });
  } catch (error) {
    res.status(500).json({ message: "Error creating order", error });
  }
}

// Update Order Status on Payment Confirmation
export async function updateOrderStatusToPaid(req, res) {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId).populate("products.productId");
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.paymentStatus === "Paid") {
      return res
        .status(400)
        .json({ message: "Order is already marked as Paid" });
    }

    // Update stock levels only after payment confirmation
    for (const product of order.products) {
      const productDetails = await Product.findById(product.productId._id);
      productDetails.availableStock -= product.quantity;
      await productDetails.save();
    }

    order.paymentStatus = "Paid";
    order.orderStatus = "Approved";
    await order.save();

    res.status(200).json({
      message: "Order status updated to Paid and Awaiting Collection",
      order,
    });
  } catch (error) {
    res.status(500).json({ message: "Error updating order status", error });
  }
}

// Get All Orders
export async function getAllOrders(req, res) {
  try {
    const orders = await Order.find().populate(
      "farmerId",
      "_id farmName farmLocation telNumber email firstName lastName"
    ); // Added await here
    return res.status(200).json({
      orders,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching orders", error: error.message });
  }
}

export async function getOrdersByFarmerId(req, res) {
  try {
    const { farmerId } = req.params; // Extracting the farmerId from the request parameters
    const orders = await Order.find({ farmerId })
      .populate(
        "farmerId",
        "_id farmName farmLocation telNumber email firstName lastName"
      )
      .populate("products.productId", "name description price"); // Populate product details if needed

    if (!orders || orders.length === 0) {
      return res.status(404).json({ message: "No orders found for this user" });
    }

    return res.status(200).json({ orders });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching orders", error: error.message });
  }
}

// Get Order by ID
export async function getOrderById(req, res) {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId).populate(
      "farmerId",
      "_id farmName farmLocation telNumber email firstName lastName"
    );

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    res.status(200).json({ order });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching order", error: error.message });
  }
}

// Update an Existing Order
export async function updateOrder(req, res) {
  try {
    const { orderId } = req.params;
    const { products, orderStatus, awaitingPickup } = req.body;

    // Find the order by ID
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Find the user associated with the order
    const user = await User.findById(order.farmerId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Update products if provided
    if (products && Array.isArray(products) && products.length > 0) {
      const updatedProducts = [];
      let totalCost = 0;

      for (const product of products) {
        if (!product?.productId || !product?.quantity) {
          return res.status(400).json({
            message: "Invalid product data provided",
          });
        }

        const productDetails = await Product.findById(product.productId);
        if (!productDetails) {
          return res.status(404).json({
            message: `Product with ID ${product.productId} not found`,
          });
        }

        // Check stock availability
        if (product.quantity > productDetails.availableStock) {
          return res.status(400).json({
            message: `Insufficient stock for ${productDetails.productName}`,
          });
        }

        // Calculate cost for each product
        const cost = product.quantity * productDetails.sellingPrice;
        totalCost += cost;
        updatedProducts.push({
          productId: product.productId,
          productName: productDetails.productName,
          quantity: product.quantity,
          unitPrice: productDetails.sellingPrice,
          cost: cost,
        });
      }

      // Update order with new products and total cost
      order.totalCost = totalCost;
      order.products = updatedProducts;
    }

    // Update order status if provided
    if (orderStatus) {
      order.orderStatus = orderStatus;

      // If order is rejected, delete it
      if (orderStatus === "Rejected") {
        await Order.findByIdAndDelete(orderId);
        return res.status(200).json({
          message: "Order rejected and deleted successfully",
        });
      }
    }

    // Update pickup status
    if (awaitingPickup && awaitingPickup === "Completed") {
      order.awaitingPickup = awaitingPickup;

      // Use provided products if available, else fall back to order.products
      const productsArray =
        Array.isArray(products) && products.length > 0
          ? products
          : order.products;

      console.log(productsArray, "this is the product array");

      for (const product of productsArray) {
        if (!product?.productId || !product?.quantity) {
          return res.status(400).json({
            message: "Invalid product data during pickup update.",
          });
        }

        const productDetails = await Product.findById(product.productId).select(
          "-transactions"
        );
        console.log(productDetails, "this is the product details");

        if (!productDetails) {
          return res.status(404).json({
            message: `Product with ID ${product.productId} not found`,
          });
        }

        // Deduct stock
        const newStockBalance =
          productDetails.stockBalance - product.quantity;

        productDetails.stockBalance = newStockBalance;
        await productDetails.save();
      }
    }

    // Save updated order
    await order.save();

    res.status(200).json({
      message: "Order updated successfully",
      order,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error updating order",
      error: error.message,
    });
  }
}


export async function getPendingOrdersCount(req, res) {
  try {
    // Count all orders where orderStatus is "pending"
    const pendingCount = await Order.countDocuments({
      orderStatus: "Pending",
    });

    return res.status(200).json({
      success: true,
      count: pendingCount,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}
