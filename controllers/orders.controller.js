import prisma from "../utils/prisma.js";


// Create a new Order
export async function createOrder(req, res) {
  try {
    const { farmerId, products } = req.body;
    const orderProducts = [];
    let totalCost = 0;

    for (const product of products) {
      const productDetails = await prisma.product.findUnique({
        where: { id: product.productId },
      });
      if (!productDetails) {
        return res.status(404).json({
          message: `Product with ID ${product.productId} not found`,
        });
      }

      if (product.quantity > productDetails.availableStock) {
        return res.status(400).json({
          message: `Insufficient stock for ${productDetails.name}`,
        });
      }

      const cost = product.quantity * productDetails.sellingPrice;
      totalCost += cost;
      orderProducts.push({
        productId: product.productId,
        productName: productDetails.name,
        quantity: product.quantity,
        unitPrice: productDetails.sellingPrice,
        cost: cost,
      });
    }

    const newOrder = await prisma.order.create({
      data: {
        farmerId,
        orderProducts: {
          create: orderProducts.map((product) => ({
            productId: product.productId,
            productName: product.productName,
            quantity: product.quantity,
            unitPrice: product.unitPrice,
            cost: product.cost,
          })),
        },
        orderStatus: "Pending",
        paymentStatus: "Pending",
        totalCost: totalCost,
      },
    });

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
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
      products: {
        include: {
        productId: true,
        },
      },
      },
    });
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
      const productDetails = await prisma.product.findUnique({
        where: { id: product.productId },
      });
      await prisma.product.update({
        where: { id: product.productId },
        data: {
          availableStock: productDetails.availableStock - product.quantity,
        },
      });
    }
    
    await prisma.order.update({
      where: { id: orderId },
      data: {
      paymentStatus: "Paid",
      orderStatus: "Approved",
      },
    });

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
    const orders = await prisma.order.findMany({
      include: {
      farmer: {
        select: {
        id: true,
        farmName: true,
        farmLocation: true,
        telNumber: true,
        email: true,
        firstName: true,
        lastName: true,
        },
      },
      },
    });
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
    const orders = await prisma.order.findMany({
      where: { farmerId: farmerId },
      include: {
      farmer: {
        select: {
        id: true,
        farmName: true,
        farmLocation: true,
        telNumber: true,
        email: true,
        firstName: true,
        lastName: true,
        },
      },
      orderProducts: {
        include: {
        product: {
          select: {
          name: true,
          description: true,
          sellingPrice: true,
          },
        },
        },
      },
      },
    });

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
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
      farmer: {
        select: {
        id: true,
        farmName: true,
        farmLocation: true,
        telNumber: true,
        email: true,
        firstName: true,
        lastName: true,
        },
      },
      },
    });

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
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });
    
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Find the user associated with the order
    const user = await prisma.user.findUnique({
      where: { id: order.farmerId },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    // Update order status if provided
    if (orderStatus) {
      // If order is rejected, delete it
      if (orderStatus === "Rejected") {
        await prisma.order.delete({
          where: { id: orderId },
        });
        return res.status(200).json({
          message: "Order rejected and deleted successfully",
        });
      }
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

        const productDetails = await prisma.product.findUnique({
          where: { id: product.productId },
        });
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
      // Update the order with new products and total cost
      await prisma.order.update({
        where: { id: orderId },
        data: {
          orderProducts: {
        upsert: updatedProducts.map((product) => ({
          where: { productId: product.productId },
          update: {
            quantity: product.quantity,
            unitPrice: product.unitPrice,
            cost: product.cost,
          },
          create: {
            productId: product.productId,
            productName: product.productName,
            quantity: product.quantity,
            unitPrice: product.unitPrice,
            cost: product.cost,
          },
        })),
        deleteMany: {
          productId: {
            notIn: updatedProducts.map((product) => product.productId),
          },
        },
          },
          totalCost: totalCost, // Update total cost
        },
      });
      
    }

    // Update pickup status
    if (awaitingPickup && awaitingPickup === "Completed") {
      await prisma.order.update({
        where: { id: orderId },
        data: {
          awaitingPickup: "Completed",
        },
      });

      // Use provided products if available, else fall back to order.products
      const productsArray =
        Array.isArray(products) && products.length > 0
          ? products
          : order.products;


      for (const product of productsArray) {
        if (!product?.productId || !product?.quantity) {
          return res.status(400).json({
            message: "Invalid product data during pickup update.",
          });
        }

        const productDetails = await prisma.product.findUnique({
          where: { id: product.productId },
        });
        console.log(productDetails, "this is the product details");

        if (!productDetails) {
          return res.status(404).json({
            message: `Product with ID ${product.productId} not found`,
          });
        }

        // Deduct stock
        await prisma.product.update({
          where: { id: product.productId },
          data: {
            availableStock: productDetails.availableStock - product.quantity,
          },
        });
      }
    }
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
    const pendingCount = await prisma.order.count({
      where: {
      orderStatus: "Pending",
      },
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
