import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import { sendInvoiceEmail } from "../helpers/sendInvoice.js";
import { fileURLToPath } from 'url';
import  prisma  from "../utils/prisma.js";

// Create a new Invoice
export async function createInvoice(req, res) {
    try {
        const { orderId, farmerId, totalAmount, email, farmerName } = req.body;
        
        // Validate required fields
        if (!orderId || !farmerId || !totalAmount || !email || !farmerName) {
            return res.status(400).json({
                message: "Missing required fields",
                required: ["orderId", "farmerId", "totalAmount", "email", "farmerName"]
            });
        }

        // Step 1: Find the order by ID
        const order = await prisma.order.findUnique({
            where: { id: orderId }
        });
        if (!order) {
            return res.status(404).json({
                message: "Order not found",
                orderId
            });
        }

        // Check if order already has an invoice
        if (order.invoiceId) {
            return res.status(409).json({
                message: "Invoice already exists for this order",
                existingInvoiceId: order.invoiceId
            });
        }

        // Step 2: Create and save the invoice
        const savedInvoice = await prisma.invoice.create({
            data : {
                orderId,
                farmerId,
                totalAmount,
                farmerName,
                status: "Pending",
                pdfDownloadLink: ""
            }
        });
        const invoiceId = savedInvoice.id;

        try {
            // Step 3: Generate PDF
            const pdfPath = await generateInvoicePDF({ 
                invoiceId, 
                farmerName 
            });

            // Step 4: Send email
            await sendInvoiceEmail({ 
                email, 
                invoiceId, 
                pdfPath, 
                farmerName 
            });

            // Generate download link
            const baseUrl = `${req.protocol}://${req.get("host")}`;
            const pdfDownloadLink = `${baseUrl}/api/invoices/files/invoice_${invoiceId}.pdf`;

            // Step 5: Update order and invoice in parallel
            await Promise.all([
                prisma.order.update({
                    where: { id: orderId },
                    data: {
                        invoiceId: savedInvoice.id,
                        invoiceGenerated: true,
                    }
                }),
                prisma.invoice.update({
                    where: { id: invoiceId },
                    data: {
                        pdfDownloadLink,
                        status: "Pending",
                        emailSent: true,
                    }   
                })
            ]);

            return res.status(201).json({
                message: "Invoice created and email sent successfully",
                invoiceId,
                pdfDownloadLink
            });

        } catch (error) {
            // Cleanup on failure
            await Promise.all([
                prisma.invoice.delete({
                    where: { id: invoiceId }
                }),
                prisma.order.update({
                    where: { id: orderId },
                    data: { 
                        invoiceId: null, // Unset the invoiceId
                        updatedAt: new Date() // Update timestamp
                    }
                })
            ]);
            throw error; // Let the outer catch block handle it
        }

    } catch (error) {
        console.error("Invoice creation failed:", error);
        return res.status(500).json({ 
            message: "Failed to create invoice",
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}

// Update Invoice Status (Trigger for Payment Confirmation)
export async function updateInvoiceStatus(req, res) {
    try {
        const { invoiceId } = req.params;
        const { status } = req.body;
        console.log(invoiceId)

        // Validate required fields
        if (!status) {
            return res.status(400).json({
                message: "Missing required field: status",
                required: ["status"]
            });
        }

        // Find and update the invoice
        const updatedInvoice = await prisma.invoice.update({
            where: { id: invoiceId },
            data: { status }
        });

        if (!updatedInvoice) {
            return res.status(404).json({ message: "Invoice not found" });
        }

        // Send success response
        res.status(200).json({
            message: "Invoice status updated successfully",
            updatedInvoice
        });
    } catch (error) {
        console.error("Error updating invoice status:", error);
        res.status(500).json({
            message: "Error updating invoice status",
            error: error.message
        });
    }
}


// Get All Invoices
export async function getAllInvoices(req, res) {
    try {
        const invoices = await prisma.invoice.findMany()
        res.status(200).json({ invoices });
    } catch (error) {
        res.status(500).json({ message: "Error fetching invoices", error });
    }
}

// Delete Invoice
export async function deleteInvoice(req, res) {
    try {
        const { invoiceId } = req.params;
        const invoice = await prisma.invoice.delete({
            where: { id: invoiceId }
        });
        if (!invoice) {
            return res.status(404).json({ message: "Invoice not found" });
        }
        res.status(200).json({ message: "Invoice deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: "Error deleting invoice", error });
    }
}




export async function generateInvoicePDF({ invoiceId, farmerName }) {
    try {
        const invoice = await prisma.invoice.findUnique({
            where: { id: invoiceId },
            include: {
            order: {
                include: {
                orderProducts: true
            },        },
            farmer : true
            }
        });

        if (!invoice) {
            throw new Error("Invoice not found");
        }

        // Initialize PDF document with A4 size
        const doc = new PDFDocument({
            size: 'A4',
            margin: 0,
            autoFirstPage: false
        });

        // Constants for layout (based on A4 dimensions)
        const PAGE_WIDTH = 595.28;
        const PAGE_HEIGHT = 841.89;
        const MARGIN = 40;
        const CONTENT_WIDTH = PAGE_WIDTH - (MARGIN * 2);

        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        const filePath = path.join(__dirname, "../public/invoices", `invoice_${invoiceId}.pdf`);
        doc.pipe(fs.createWriteStream(filePath));

        // Define colors for a professional look
        const colors = {
            primary: "#1a5d1a",
            secondary: "#f0f7f0",
            accent: "#2e8b57",
            text: "#2c3e50",
            muted: "#7f8c8d"
        };

        // Define reusable styles
        const styles = {
            title: { fontSize: 22, color: colors.primary, font: 'Helvetica-Bold' },
            subtitle: { fontSize: 14, color: colors.primary, font: 'Helvetica-Bold' },
            heading: { fontSize: 10, color: colors.text, font: 'Helvetica-Bold' },
            normal: { fontSize: 9, color: colors.text, font: 'Helvetica' },
            small: { fontSize: 8, color: colors.muted, font: 'Helvetica' }
        };

        // Calculate dynamic spacing based on content
        const products = invoice.order.orderProducts;
        const farmer = invoice.farmer;
        const rowHeight = 18;
        const tableHeaderHeight = 20;
        const tableBodyHeight = products.length * rowHeight;
        const contentHeight = 780;

        // Add page with exact A4 dimensions
        doc.addPage({
            size: 'A4',
            margin: 0
        });

        // Helper function to format currency
        const formatCurrency = (amount) => `€ ${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;

        // Helper function for consistent text styling
        const applyStyle = (style) => {
            doc.font(style.font)
               .fontSize(style.fontSize)
               .fillColor(style.color);
        };

        // Draw background header
        doc.rect(0, 0, doc.page.width, 160)
           .fill(colors.secondary);

        // Add logo
        const imagePath = path.join(__dirname, "../public/images", "spegpine_logo_no_background.png");
        doc.image(imagePath, 40, 40, { width: 100 });

        // Modified company details positioning and width
        const companyDetailsX = MARGIN;
        const companyDetailsWidth = PAGE_WIDTH - (MARGIN * 2) - 120; // Subtract logo width and some padding

        // Add company details (right-aligned with adjusted width)
        applyStyle(styles.normal);
        doc.text('Pineapple Producers And Exporters of Ghana', companyDetailsX + 120, 35, { align: 'right', width: companyDetailsWidth })
           .text('Contact Person: STEPHEN MINTAH (General Manager)', companyDetailsX + 120, 50, { align: 'right', width: companyDetailsWidth })
           .text('Location: Olusegun Obasanjo Way, Ampomah House, First Floor, Accra.', companyDetailsX + 120, 65, { align: 'right', width: companyDetailsWidth })
           .text('Tel: +233-(0)302-244357 | +233-(0)302-244358 | Digital Address: GA-062-3905', companyDetailsX + 120, 80, { align: 'right', width: companyDetailsWidth })
           .text('Email: speg@spegpine.com, spegpine@yahoo.co.uk | Web: www.spegpine.com', companyDetailsX + 120, 95, { align: 'right', width: companyDetailsWidth });

        // Add invoice title and number
        applyStyle(styles.title);
        doc.text('INVOICE', 40, 110);
        
        applyStyle(styles.normal);
        doc.text(`#${invoice.id.toString().slice(0,8).toUpperCase()}`, 40, 135)
           .text(`Order: #${invoice.order.id.toString()}`, 40, 148);

        // Add date and due date
        const issueDate = new Date();
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 7); 
        
        const dateOptions = { year: 'numeric', month: 'long', day: 'numeric' };
        
        const dateX = PAGE_WIDTH - MARGIN - 150; // Adjusted position for dates
        doc.text('Date:', dateX, 130)
           .text(issueDate.toLocaleDateString('en-US', dateOptions), dateX + 50, 130)
           .text('Due Date:', dateX, 140)
           .text(dueDate.toLocaleDateString('en-US', dateOptions), dateX + 50, 140);

        // Add billing information
        const billingStartY = 180;
        applyStyle(styles.subtitle);
        doc.text('BILL TO:', 40, billingStartY);

        applyStyle(styles.normal);
        doc.text(farmerName, 40, billingStartY + 20)
           .text(farmer.farmName, 40, billingStartY + 35)
           .text(farmer.farmLocation, 40, billingStartY + 45)
           .text(`Farmer ID: ${invoice.farmerId}`, 40, billingStartY + 55);

        // Draw table header
        const tableTop = billingStartY + 70;
        const columns = [
            { name: 'Product Description', width: 240, align: 'left' },
            { name: 'Quantity', width: 70, align: 'center' },
            { name: 'Unit Price', width: 100, align: 'right' },
            { name: 'Amount', width: 100, align: 'right' }
        ];

        // Draw table header background
        doc.rect(40, tableTop, doc.page.width - 80, tableHeaderHeight)
           .fill(colors.primary);

        // Add table headers
        let xPosition = 40;
        applyStyle(styles.heading);
        doc.fillColor('#FFFFFF');
        columns.forEach(column => {
            doc.text(
                column.name,
                xPosition + 5,
                tableTop + 6,
                { width: column.width, align: column.align }
            );
            xPosition += column.width;
        });

        // Add table rows
        let yPosition = tableTop + tableHeaderHeight;
        let totalAmount = 0;

        products.forEach((product, index) => {
            const isEvenRow = index % 2 === 0;
            if (isEvenRow) {
                doc.rect(40, yPosition, doc.page.width - 80, rowHeight)
                   .fill(colors.secondary);
            }

            applyStyle(styles.normal);
            doc.fillColor(colors.text);
            
            let xPos = 40;
            const amount = product.quantity * product.unitPrice;
            totalAmount += amount;

            // Product name
            doc.text(
                product.productId.productName,
                xPos + 5,
                yPosition + 5,
                { width: columns[0].width - 10 }
            );
            xPos += columns[0].width;

            // Quantity
            doc.text(
                product.quantity.toString(),
                xPos,
                yPosition + 5,
                { width: columns[1].width, align: 'center' }
            );
            xPos += columns[1].width;

            // Unit price
            doc.text(
                formatCurrency(product.unitPrice),
                xPos,
                yPosition + 5,
                { width: columns[2].width, align: 'right' }
            );
            xPos += columns[2].width;

            // Total amount
            doc.text(
                formatCurrency(amount),
                xPos,
                yPosition + 5,
                { width: columns[3].width, align: 'right' }
            );

            yPosition += rowHeight;
        });

        // Add totals section
        const totalsStartY = yPosition + 20;
        doc.rect(40, yPosition, doc.page.width - 80, 1)
           .fill(colors.primary);

        // Calculate tax and total
        const tax = totalAmount * 0.00; // 0% tax
        const finalTotal = totalAmount + tax;

        // Modified summary section with adjusted positioning
        const summaryX = PAGE_WIDTH - MARGIN - 250; // Adjusted starting position
        const summaryLabelWidth = 100;
        const summaryAmountWidth = 140;
        
        const summaryItems = [
            { label: 'Subtotal:', amount: totalAmount },
            { label: 'Tax (0%):', amount: tax },
            { label: 'Total:', amount: finalTotal, isTotal: true }
        ];

        summaryItems.forEach((item, index) => {
            const yPos = totalsStartY + (index * 20);
            
            if (item.isTotal) {
                doc.rect(summaryX - 10, yPos - 2, summaryLabelWidth + summaryAmountWidth + 20, 24)
                   .fill(colors.secondary);
                applyStyle(styles.subtitle);
            } else {
                applyStyle(styles.normal);
            }

            doc.text(item.label, summaryX, yPos, { width: summaryLabelWidth, align: 'right' })
               .text(formatCurrency(item.amount), summaryX + summaryLabelWidth, yPos, { width: summaryAmountWidth, align: 'right' });
        });

        // Add payment instructions and terms
        const termsY = totalsStartY + 100;
        applyStyle(styles.subtitle);
        doc.text('Payment Instructions:', 40, termsY);

        applyStyle(styles.normal);
        doc.text('Please include invoice number on your payment.', 40, termsY + 20)
           .text('Name: Sea-Freight Pineapple Exporters of Ghana Sea-Freight Pineapple Exporters of Ghana', 40, termsY + 35)
           .text('Bank: Access Bank Ghana', 40, termsY + 50)
           .text('Branch: North Industrial Area', 40, termsY + 65)
           .text('Account: 1017000003768 (GHS) | 1017000004257(EUR)', 40, termsY + 80);

        // Footer
        const footerY = PAGE_HEIGHT - 80;
        doc.rect(0, footerY, PAGE_WIDTH, 80)
           .fill(colors.secondary);

        applyStyle(styles.small);
        doc.text('Thank you for your business. This invoice is due within 7 days.',
            MARGIN, footerY + 20, { width: CONTENT_WIDTH, align: 'center' })
           .text('For questions about this invoice, please contact speg@spegpine.com or call +233-(0)302-244357 | +233-(0)302-244358',
            MARGIN, footerY + 35, { width: CONTENT_WIDTH, align: 'center' });

        // Finalize PDF
        doc.end();
        return filePath;

    } catch (error) {
        throw new Error("Error generating invoice PDF: " + error.message);
    }
}
