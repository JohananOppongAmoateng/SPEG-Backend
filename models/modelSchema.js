import mongoose from "mongoose";

// Schema for individual transactions for a product
const transactionSchema = new mongoose.Schema(
    {
        receivedFromIssuedTo: {
            type: String,
            required: true // Supplier for Receipt or Farmer for Issue
        },
        qtyReceived: {
            type: Number,
            default: 0 // Quantity received during restocking
        },
        qtyIssued: {
            type: Number,
            default: 0 // Quantity issued to a farmer
        },
        cediConversionRate: {
            type: Number,
            default: 0 // Conversion rate from Euro to Cedi
        },
        proForma: {
            type: Number,
            default: 0 // Pro forma quantity issued
        },
        invoiced: {
            type: Number,
            default: 0 // Total invoiced amount
        },
        collected: {
            type: Number,
            default: 0 // Quantity collected by the farmer
        },
        farmerBalance: {
            type: Number,
            default: 0 // Balance quantity after partial collection
        },
        availableStock: {
            type: Number,
            default: 0 // Updated available stock after this transaction
        },
        stockBalance: {
            type: Number,
            default: 0 // Total stock balance including reserved quantities
        },
        orderId:{
            type: mongoose.Schema.Types.ObjectId,
            ref: "Order",
        },
        status: {
            type: String,
            enum: ["Receipt", "Issue"],
            required: true // Type of transaction (restocking or issuance)
        },
        invoiceStatus: {
            type: String,
            enum: ["Pending", "Paid"],
        },
        pickupConfirmed: {
            type: Boolean,
            default: false // Whether the product has been picked up by the farmer
        },
        valueInEuro: {
            type: Number,
            default: 0 // Value in Euro
        },
        valueInCedi: {
            type: Number,
            default: 0 // Equivalent value in Cedis
        },
        outOfOrderDate: {
            type: Date
        }
    },
    {
        timestamps: true
    }
);

// Main Product schema
const productSchema = new mongoose.Schema(
    {
        productName: {
            type: String,
            required: true // Name of the product (e.g., "Ammonium", "Urea")
        },
        stockKeepingUnit: {
            type: String,
            required: true
        },
        unitPrice: {
            type: Number, // Price per unit in Euros
            default: 0
        },
        availableStock: {
            type: Number,
            default: 0 // Available stock
        },
        stockBalance: {
            type: Number,
            default: 0 // Stock balance including reserved quantities
        },
        sellingPrice: {
            type: Number,
            default: 0 // the selling Price
        },
        reOrderLevel: {
            type: Number,
            default: 0 // the selling Price
        },
        transactions: [transactionSchema] // Array of transactions related to this product
    },
    {
        timestamps: true
    }
);

// orders schema
const orderSchema = new mongoose.Schema({
    farmerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "UserSpeg",
        required: true // Reference to the farmer who placed the order
    },
    products: [
        {
            productId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Product",
                required: true // Product associated with this order
            },
            productName: {
                type: String,
                required: true
            },
            quantity: {
                type: Number,
                required: true // Quantity of the product ordered
            },
            unitPrice: {
                type: Number,
                required: true // Unit price of the product at the time of order
            },
            cost: {
                type: Number,
                required: true // Total cost for the product (quantity * unit price)
            }
        }
    ],
    totalCost: {
        type: Number
    },
    invoiceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Invoice"
    },
    orderStatus: {
        type: String,
        enum: ["Pending", "Approved", "Rejected"],
        default: "Pending" 
    },
    awaitingPickup: {
        type: String,
        enum: ["Awaiting Collection", "Completed"],
        default: "Awaiting Collection"
    },
    paymentStatus: {
        type: String,
        enum: ["Pending", "Paid"],
        default: "Pending" // Status of the payment for this order
    },
    invoiceGenerated: {
        type: Boolean,
        default: false // Whether an invoice has been generated for this order
    },

    createdAt: {
        type: Date,
        default: Date.now // Date when the order was placed
    }
});

// invoice schema
const invoiceSchema = new mongoose.Schema(
    {
        orderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Order",
            required: true // Reference to the order associated with this invoice
        },
        farmerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Farmer",
            required: true // Reference to the farmer who will receive the invoice
        },
        currency: {
            type: String,
            default: "Euro" // Currency in which the invoice is generated
        },
        farmerName: {
            type: String
        },
        totalAmount: {
            type: Number,
            required: true // Total amount to be paid
        },
        outOfOrderDate: {
            type: Date
        },
        status: {
            type: String,
            enum: ["Pending", "Paid"],
            default: "Pending" // Status of the invoice
        },
        pdfDownloadLink: {
            type: String,
            default: "" // Link to the downloadable PDF of the invoice
        },
        emailSent: {
            type: Boolean,
            default: false // Whether the invoice email has been sent to the farmer
        }
    },
    {
        timestamps: true
    }
);

const userSchema = new mongoose.Schema(
    {
        firstName: {
            type: String
        },
        lastName: {
            type: String
        },
        email: {
            type: String,
            required: [true, "Please provide your email"],
            unique: true,
            lowercase:true
        },
        password: {
            type: String,
            trim:true,
            required: [true, "Please provide your Password"],
        },
        farmName: {
            type: String
        },
        farmLocation: {
            type: String
        },
        telNumber: {
            type: String // Changed to String
        },
        role: {
            type: String
        },
        emailVerified: {
            type: Boolean,
            default: false
        },
        adminVerified: {
            type: Boolean,
            default: false
        },
        refreshToken: {
            type: String
        },
        forgotPasswordToken: {
            type: String
        },
        forgotPasswordTokenExpiry: {
            type: Date
        },
        verifyToken: {
            type: String
        },
        verifyTokenExpiry: {
            type: Date
        }
    },
    {
        timestamps: true // Corrected to plural
    }
);

const Product = mongoose.model("Product", productSchema);
const Transaction = mongoose.model("Transaction", transactionSchema);
const Order = mongoose.model("Order", orderSchema);
const Invoice = mongoose.model("Invoice", invoiceSchema);
const User = mongoose.model("UserSpeg", userSchema);

export { Product, Transaction, Order, Invoice, User };
