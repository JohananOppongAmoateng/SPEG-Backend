import dotEnv from "dotenv";
dotEnv.config();
import { createTransport } from "nodemailer";
import smtpTransport from "nodemailer-smtp-transport";
import fs from 'fs';

export async function sendInvoiceEmail({  email, invoiceId, pdfPath ,farmerName }) {
    try {
        // Create transporter
        const transporter = createTransport(
            smtpTransport({
                service: "gmail",
                auth: {
                    user: process.env.MAIL_USER,
                    pass: process.env.MAIL_PASSWORD,
                },
            })
        );

       

        // Mail options with styled HTML and attachment
        const mailOptions = {
            from: "admin@spegpine.com",
            to: email,
            subject: "Your SpegPine Invoice",
            html: `
                <div style="font-family: 'Arial', sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
                    <div style="text-align: center; padding-bottom: 20px;">
                        <img src="https://spegpine.com/wp-content/uploads/2021/02/spegpine_logo.jpg" alt="SpegPine Logo" style="max-width: 120px;">
                    </div>
                    <h2 style="color: #228B22; text-align: center;">Your Invoice from SpegPine</h2>
                    <p style="font-size: 16px; color: #555;">Hello,${farmerName}</p>
                    <p style="font-size: 16px; color: #555;">
                        Please find attached your invoice with ID <strong>${invoiceId}</strong> for your recent order with SpegPine. 
                        We appreciate your business and look forward to serving you again.
                    </p>
                    <p style="font-size: 16px; color: #555;">
                        Should you have any questions, feel free to reach out to us at <a href="mailto:support@spegpine.com" style="color: #228B22; text-decoration: none;">support@spegpine.com</a>.
                    </p>
                    <p style="font-size: 16px; color: #555;">Warm regards,<br>The SpegPine Team</p>
                    <div style="text-align: center; margin-top: 30px;">
                        <a href="https://spegpine.com" style="color: #228B22; font-size: 14px; text-decoration: none; font-weight: bold;">Visit our website</a>
                    </div>
                </div>
            `,
            attachments: [
                {
                    filename: `invoice_${invoiceId}.pdf`,
                    path: pdfPath,
                    contentType: 'application/pdf'
                }
            ]
        };

        // Send email
        const mailResponse = await transporter.sendMail(mailOptions);
        
        // Remove the local PDF file after sending
        // fs.unlinkSync(pdfPath);

        return mailResponse;
    } catch (error) {
        throw new Error("Error sending invoice email: " + error.message);
    }
}
