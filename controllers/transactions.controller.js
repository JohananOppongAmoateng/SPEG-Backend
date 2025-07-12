import prisma from "../utils/prisma.js";

// Handle Issue Transaction (Sale or Distribution to a Farmer)
export async function issueProduct(req, res) {
  try {
    const { id } = req.params;
    const { receivedFromIssuedTo, qtyIssued, invoicedAmount, orderId } =
      req.body;

    if (!id) {
      return res.status(400).json({ message: "Please provide product id" });
    }

    // Find the product by ID
    const product = await prisma.product.findUnique({
      where: {
        id: id
      },
      include: {
        transactions : true
      }
    });

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Check if there is enough available stock for the issue
    if (qtyIssued > product.availableStock) {
      return res.status(400).json({
        message: "Insufficient stock to issue the requested quantity",
      });
    }

    // Find the latest transaction with status "Receipt"
    const latestReceiptTransaction = product.transactions
      .filter((t) => t.status === "Receipt")
      .sort((a, b) => b.date - a.date)[0];

    if (!latestReceiptTransaction) {
      return res.status(400).json({
        message:
          "No receipt transaction found to determine cedi conversion rate",
      });
    }

    const cediConversionRate = latestReceiptTransaction.cediConversionRate;

    if (isNaN(cediConversionRate) || typeof cediConversionRate !== "number") {
      return res.status(400).json({
        message:
          "Invalid cedi conversion rate in the latest receipt transaction",
      });
    }

    if (isNaN(invoicedAmount) || typeof invoicedAmount !== "number") {
      return res.status(400).json({ message: "Invalid invoiced amount" });
    }

    // Log the values for debugging
    console.log("invoicedAmount:", invoicedAmount);
    console.log("cediConversionRate:", cediConversionRate);

    // Create a new issue transaction
    const newTransaction = await prisma.transaction.create({
      data: {
      receivedFromIssuedTo,
      outOfOrderDate: new Date(), // Set the current date as outOfOrderDate
      qtyIssued,
      proForma: qtyIssued,
      invoiced: invoicedAmount,
      farmerBalance: qtyIssued,
      availableStock: product.availableStock - qtyIssued,
      stockBalance: product.stockBalance,
      valueInEuro: invoicedAmount,
      valueInCedi: Number((invoicedAmount * cediConversionRate).toFixed(2)),
      status: "Issue",
      invoiceStatus: "Paid",
      pickupConfirmed: false,
      cediConversionRate: cediConversionRate, // Store the used conversion rate
      product: {
        connect: { id: product.id },
      },
      order: {
        connect: { id: orderId }, // Connect to the order if provided
      }
      },
    });

    // Update the product's available stock immediately
    await prisma.product.update({
      where: { id: product.id },
      data: {
      availableStock: product.availableStock - qtyIssued,
      transactions: {
        connect: { id: newTransaction.id },
      },
      },
    });

    res.status(200).json({ message: "Product issued successfully", product });
  } catch (error) {
    res.status(500).json({ message: "Error issuing product", error });
    console.log(error);
  }
}

export async function restockProduct(req, res) {
  try {
    const { id } = req.params;
    const {
      qtyReceived,
      receivedFrom,
      valueInEuro,
      sellingPrice,
      cediConversionRate,
      outOfOrderDate,
    } = req.body;

    if (!id) {
      return res.status(400).json({ message: "Please provide product id" });
    }

    // Find the product by ID
    const product = await prisma.product.findUnique({
      where: {
        id: id
      }
    });

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Calculate the value in Cedi
    const valueInCedi = valueInEuro * cediConversionRate;

    // Create a new receipt transaction
    const newTransaction = await prisma.transaction.create({
      data: {
      receivedFromIssuedTo: receivedFrom,
      qtyReceived,
      valueInEuro,
      valueInCedi,
      cediConversionRate,
      outOfOrderDate: outOfOrderDate ? new Date(outOfOrderDate) : undefined, // Store the outOfOrderDate if provided
      availableStock: product.availableStock + qtyReceived,
      stockBalance: product.stockBalance + qtyReceived,
      status: "Receipt",
      product: {
        connect: { id: product.id },
      },
      },
    });

    // Update stock levels and selling price
    await prisma.product.update({
      where: { id: product.id },
      data: {
      availableStock: product.availableStock + qtyReceived,
      stockBalance: product.stockBalance + qtyReceived,
      sellingPrice: sellingPrice,
      transactions: {
        connect: { id: newTransaction.id },
      },
      },
    });

    res.status(200).json({
      message: "Product restocked successfully",
      product,
    });
  } catch (error) {
    res.status(500).json({ message: "Error restocking product", error });
  }
}

export const updatePickup = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ message: "Please provide an order ID" });
    }

    // Await the result of the findOne call
    const transaction = await prisma.transaction.findUnique({
      where: { orderId: id },
    });

    // Check if the transaction is not found
    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    // Update and save the transaction
    await prisma.transaction.update({
      where: { id: id },
      data: { pickupConfirmed: true },
    });

    // Respond with success
    return res
      .status(200)
      .json({ message: "Pickup successfully confirmed", transaction });
  } catch (error) {
    // Better error message with status 500
    res.status(500).json({ message: "Error updating pickup", error });
  }
};

export async function deleteTransaction(req, res) {
  try {
    const { productId, transactionId } = req.params;

    // Step 1: Fetch only the specific transaction and availableStock
    const productWithTransaction = await prisma.product.findUnique({
      where: { id: productId },
      select: {
      availableStock: true,
      transactions: {
        where: { id: transactionId },
        take: 1,
      },
      },
    });

    if (!productWithTransaction) {
      return res
        .status(404)
        .json({ success: false, error: "Product or transaction not found" });
    }

    const transaction = productWithTransaction.transactions[0];

    // Step 2: Determine stock updates based on transaction type
    let stockUpdate = {};
    if (transaction.status === "Receipt") {
      const qty = transaction.qtyReceived;
      // Check for negative stock
      if (productWithTransaction.availableStock < qty) {
        return res.status(400).json({
          success: false,
          error:
            "Cannot delete receipt transaction: would result in negative stock",
        });
      }
      stockUpdate.availableStock = -qty;
      stockUpdate.stockBalance = -qty;
    } else if (transaction.status === "Issue") {
      const qty = transaction.qtyIssued;
      stockUpdate.availableStock = qty;
      stockUpdate.stockBalance = qty;
    }

    // Step 3: Update the product atomically
    await prisma.product.update({
      where: { id: productId },
      data: {
      transactions: {
        delete: { id: transactionId },
      },
      availableStock: {
        increment: stockUpdate.availableStock,
      },
      stockBalance: {
        increment: stockUpdate.stockBalance,
      },
      },
    });

    // Step 4: Handle order update if necessary
    if (transaction.status === "Issue" && transaction.orderId) {
      const order = await prisma.order.findUnique({
      where: { id: transaction.orderId },
      });
      if (order && order.orderStatus === "Approved") {
      await prisma.order.update({
        where: { id: transaction.orderId },
        data: { orderStatus: "Pending" },
      });
      }
    }

    // Step 5: Send success response
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error in deleteTransaction:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
