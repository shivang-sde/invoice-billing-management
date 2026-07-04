import db from "../config/db.js";
import { createAuditLog } from "../utils/auditLogger.js";
import { notifyBusinessUsers } from "../utils/notificationLoggers.js";
import { emitDashboardUpdate } from "../utils/socketEvents.js";

const ALLOWED_PAYMENT_METHODS = [
  "cash",
  "upi",
  "bank_transfer",
  "card",
  "cheque",
  "wallet",
  "other",
];

const formatAmount = (amount) => Number(amount || 0).toFixed(2);

const normalizeText = (value) => {
  if (value === undefined || value === null) return "";
  return String(value).replace(/<[^>]*>?/gm, "").trim();
};

const isPositiveInteger = (value) => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0;
};

const isValidDate = (value) => {
  if (!value) return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value));
};

const getUserAgent = (req) => req.headers["user-agent"] || null;

const validatePaymentPayload = ({
  invoice_id,
  amount,
  payment_method,
  payment_date,
  notes,
}) => {
  if (!isPositiveInteger(invoice_id)) {
    return "Valid invoice is required";
  }

  const paymentAmount = Number(amount);

  if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
    return "Payment amount must be greater than 0";
  }

  if (paymentAmount > 999999999) {
    return "Payment amount is too large";
  }

  if (!payment_date || !isValidDate(payment_date)) {
    return "Valid payment date is required";
  }

  if (
    payment_method &&
    !ALLOWED_PAYMENT_METHODS.includes(normalizeText(payment_method))
  ) {
    return "Invalid payment method";
  }

  if (normalizeText(notes).length > 500) {
    return "Notes must be less than 500 characters";
  }

  return null;
};

// CREATE PAYMENT
export const createPayment = async (req, res) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const company_id = req.user.company_id;
    const { invoice_id, amount, payment_method, payment_date, notes } =
      req.body;

    if (!company_id) {
      await connection.rollback();
      return res.status(400).json({ message: "Company id missing" });
    }

    const validationError = validatePaymentPayload({
      invoice_id,
      amount,
      payment_method,
      payment_date,
      notes,
    });

    if (validationError) {
      await connection.rollback();
      return res.status(400).json({ message: validationError });
    }

    const newAmount = Number(amount);
    const cleanPaymentMethod = normalizeText(payment_method) || "cash";
    const cleanNotes = normalizeText(notes) || null;

    const [invoiceRows] = await connection.query(
      `
      SELECT
        i.*,
        c.customer_name,
        b.branch_name,
        b.branch_code
      FROM tbl_invoices i
      LEFT JOIN tbl_customers c
        ON i.customer_id = c.id
        AND c.company_id = i.company_id
      LEFT JOIN tbl_company_branches b
        ON i.branch_id = b.id
        AND b.company_id = i.company_id
      WHERE i.id = ?
      AND i.company_id = ?
      LIMIT 1
      FOR UPDATE
      `,
      [invoice_id, company_id],
    );

    if (invoiceRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: "Invoice not found" });
    }

    const invoice = invoiceRows[0];

    if (invoice.status === "cancelled") {
      await connection.rollback();
      return res.status(400).json({
        message: "Payment cannot be recorded for cancelled invoice",
      });
    }

    const totalAmount = Number(invoice.total_amount || 0);
    const currentPaidAmount = Number(invoice.paid_amount || 0);
    const currentBalanceDue = Number(invoice.balance_due || 0);

    if (invoice.status === "paid" || currentBalanceDue <= 0) {
      await connection.rollback();
      return res.status(400).json({
        message: "Invoice is already fully paid",
      });
    }

    if (newAmount > currentBalanceDue) {
      await connection.rollback();
      return res.status(400).json({
        message: `Payment amount cannot exceed remaining amount ₹${formatAmount(
          currentBalanceDue,
        )}`,
      });
    }

    const [existingPaymentRows] = await connection.query(
      `
      SELECT COALESCE(SUM(amount), 0) AS paid_amount
      FROM tbl_payments
      WHERE invoice_id = ?
      AND company_id = ?
      `,
      [invoice_id, company_id],
    );

    const existingPaidAmount = Number(existingPaymentRows[0].paid_amount || 0);
    const safePaidBase = Math.max(existingPaidAmount, currentPaidAmount);
    const newPaidAmount = safePaidBase + newAmount;

    if (newPaidAmount > totalAmount) {
      await connection.rollback();
      return res.status(400).json({
        message: "Payment amount cannot exceed remaining invoice amount",
      });
    }

    const [paymentResult] = await connection.query(
      `
      INSERT INTO tbl_payments
      (
        company_id,
        invoice_id,
        amount,
        payment_method,
        payment_date,
        notes
      )
      VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        company_id,
        invoice_id,
        newAmount,
        cleanPaymentMethod,
        payment_date,
        cleanNotes,
      ],
    );

    const balanceDue = Math.max(totalAmount - newPaidAmount, 0);
    const status = balanceDue <= 0 ? "paid" : "partial";

    await connection.query(
      `
      UPDATE tbl_invoices
      SET
        status = ?,
        paid_amount = ?,
        balance_due = ?
      WHERE id = ?
      AND company_id = ?
      `,
      [status, newPaidAmount, balanceDue, invoice_id, company_id],
    );

    await createAuditLog({
      company_id,
      user_id: req.user.id,
      role: req.user.role,
      action: "CREATE",
      module_name: "Payment",
      record_id: paymentResult.insertId,
      description: `Payment ₹${formatAmount(newAmount)} recorded for Invoice ${
        invoice.invoice_number || invoice_id
      }${invoice.branch_name ? ` (${invoice.branch_name})` : ""}`,
      ip_address: req.ip,
      user_agent: getUserAgent(req),
    });

    await createAuditLog({
      company_id,
      user_id: req.user.id,
      role: req.user.role,
      action: "UPDATE",
      module_name: "Invoice",
      record_id: invoice_id,
      description: `Invoice ${
        invoice.invoice_number || invoice_id
      } marked as ${status}. Paid ₹${formatAmount(
        newPaidAmount,
      )}, balance ₹${formatAmount(balanceDue)}`,
      ip_address: req.ip,
      user_agent: getUserAgent(req),
    });

    const branchPrefix = invoice.branch_name ? `${invoice.branch_name}: ` : "";
    const invoiceLabel = invoice.invoice_number || invoice_id;

    if (status === "paid") {
      await notifyBusinessUsers({
        company_id,
        actor_id: req.user.id,
        type: "invoice",
        severity: "medium",
        title: "Invoice Paid",
        message: `${branchPrefix}${invoiceLabel} paid.`,
        module_name: "Payment",
        record_id: paymentResult.insertId,
      });
    }

    if (status === "partial") {
      await notifyBusinessUsers({
        company_id,
        actor_id: req.user.id,
        type: "invoice",
        severity: "medium",
        title: "Invoice Partially Paid",
        message: `${branchPrefix}${invoiceLabel} partially paid.`,
        module_name: "Payment",
        record_id: paymentResult.insertId,
      });
    }

    await connection.commit();

    emitDashboardUpdate({
      company_id,
    });

    return res.status(201).json({
      message: "Payment recorded successfully",
      payment_id: paymentResult.insertId,
      paid_amount: newPaidAmount,
      remaining_amount: balanceDue,
      invoice_status: status,
      branch_id: invoice.branch_id || null,
      branch_name: invoice.branch_name || null,
      branch_code: invoice.branch_code || null,
    });
  } catch (error) {
    await connection.rollback();

    return res.status(500).json({
      message: "Payment error",
      error: error.message,
    });
  } finally {
    connection.release();
  }
};

// GET PAYMENTS
export const getPayments = async (req, res) => {
  try {
    const company_id = req.user.company_id;

    if (!company_id) {
      return res.status(400).json({
        message: "Company id missing",
      });
    }

    const [payments] = await db.query(
      `
      SELECT
        p.*,
        i.invoice_number,
        i.branch_id,
        i.total_amount,
        i.paid_amount,
        i.balance_due,
        i.status AS invoice_status,
        c.customer_name,
        b.branch_name,
        b.branch_code
      FROM tbl_payments p
      JOIN tbl_invoices i
        ON p.invoice_id = i.id
        AND i.company_id = p.company_id
      LEFT JOIN tbl_customers c
        ON i.customer_id = c.id
        AND c.company_id = i.company_id
      LEFT JOIN tbl_company_branches b
        ON i.branch_id = b.id
        AND b.company_id = i.company_id
      WHERE p.company_id = ?
      ORDER BY p.id DESC
      `,
      [company_id],
    );

    return res.json(payments);
  } catch (error) {
    return res.status(500).json({
      message: "Get payments error",
      error: error.message,
    });
  }
};

// GET PAYMENTS BY INVOICE
export const getInvoicePayments = async (req, res) => {
  try {
    const company_id = req.user.company_id;
    const { invoiceId } = req.params;

    if (!company_id) {
      return res.status(400).json({
        message: "Company id missing",
      });
    }

    if (!isPositiveInteger(invoiceId)) {
      return res.status(400).json({
        message: "Valid invoice id is required",
      });
    }

    const [invoiceRows] = await db.query(
      `
      SELECT id
      FROM tbl_invoices
      WHERE id = ?
      AND company_id = ?
      LIMIT 1
      `,
      [invoiceId, company_id],
    );

    if (invoiceRows.length === 0) {
      return res.status(404).json({
        message: "Invoice not found",
      });
    }

    const [payments] = await db.query(
      `
      SELECT
        p.*,
        i.invoice_number,
        i.branch_id,
        i.total_amount,
        i.paid_amount,
        i.balance_due,
        i.status AS invoice_status,
        c.customer_name,
        b.branch_name,
        b.branch_code
      FROM tbl_payments p
      JOIN tbl_invoices i
        ON p.invoice_id = i.id
        AND i.company_id = p.company_id
      LEFT JOIN tbl_customers c
        ON i.customer_id = c.id
        AND c.company_id = i.company_id
      LEFT JOIN tbl_company_branches b
        ON i.branch_id = b.id
        AND b.company_id = i.company_id
      WHERE p.invoice_id = ?
      AND p.company_id = ?
      ORDER BY p.id DESC
      `,
      [invoiceId, company_id],
    );

    return res.json(payments);
  } catch (error) {
    return res.status(500).json({
      message: "Get invoice payments error",
      error: error.message,
    });
  }
};