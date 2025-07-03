import { Router } from 'express';
const router = Router();
import { createInvoice, updateInvoiceStatus, getAllInvoices, deleteInvoice, generateInvoicePDF } from '../../controllers/invoice.controller.js';

// Invoice routes
router.post('/create', createInvoice); // Create a new invoice
router.patch('/:invoiceId', updateInvoiceStatus); // Update the status of an invoice
router.get('/all', getAllInvoices); // Get all invoices
router.delete('/:invoiceId', deleteInvoice); // Delete an invoice by ID
// router.get('/invoices/:invoiceId/pdf', generateInvoicePDF);

export default router;
