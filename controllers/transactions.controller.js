import { Order, Product, Transaction } from "../models/modelSchema.js";

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
    const product = await Product.findById(id);

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
    const newTransaction = {
      date: new Date(),
      receivedFromIssuedTo,
      qtyIssued,
      proForma: qtyIssued,
      invoiced: invoicedAmount,
      collected: 0,
      farmerBalance: qtyIssued,
      availableStock: product.availableStock - qtyIssued,
      stockBalance: product.stockBalance,
      valueInEuro: invoicedAmount,
      valueInCedi: Number((invoicedAmount * cediConversionRate).toFixed(2)),
      status: "Issue",
      invoiceStatus: "Paid",
      pickupConfirmed: false,
      orderId: orderId || null,
      cediConversionRate: cediConversionRate, // Store the used conversion rate
    };

    //add to transaction table
    const transaction = new Transaction(newTransaction);
    await transaction.save();

    // Add the transaction to the product's transaction array
    product.transactions.push(transaction);

    // Update the product's available stock immediately
    product.availableStock -= qtyIssued;

    // Save the product with the updated stock and transaction
    await product.save();

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
    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Calculate the value in Cedi
    const valueInCedi = valueInEuro * cediConversionRate;

    // Create a new receipt transaction
    const newTransaction = {
      date: new Date(),
      receivedFromIssuedTo: receivedFrom,
      qtyReceived,
      valueInEuro,
      valueInCedi,
      cediConversionRate,
      InvoiceDate: outOfOrderDate ? new Date(outOfOrderDate) : undefined, // Store the outOfOrderDate if provided
      availableStock: product.availableStock + qtyReceived,
      stockBalance: product.stockBalance + qtyReceived,
      status: "Receipt",
    };

    //add to transaction table
    const transaction = new Transaction(newTransaction);
    await transaction.save();
    // Add the transaction to the product's transaction array
    product.transactions.push(transaction);

    // Update stock levels and selling price
    product.availableStock += qtyReceived;
    product.stockBalance += qtyReceived;
    product.sellingPrice = sellingPrice;

    // Save the updated product
    await product.save();

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
    const transaction = await Transaction.findOne({ orderId: id });

    // Check if the transaction is not found
    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    // Update and save the transaction
    transaction.pickupConfirmed = true;
    await transaction.save();

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
    const productWithTransaction = await Product.findOne(
      { _id: productId, "transactions._id": transactionId },
      { "transactions.$": 1, availableStock: 1 }
    );

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
    await Product.updateOne(
      { _id: productId },
      {
        $pull: { transactions: { _id: transactionId } },
        $inc: stockUpdate,
      }
    );

    // Step 4: Handle order update if necessary
    if (transaction.status === "Issue" && transaction.orderId) {
      const order = await Order.findById(transaction.orderId);
      if (order && order.orderStatus === "Approved") {
        order.orderStatus = "Pending";
        await order.save();
      }
    }

    // Step 5: Send success response
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error in deleteTransaction:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
