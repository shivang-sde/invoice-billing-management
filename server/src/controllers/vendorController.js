import db from "../config/db.js";
import { createAuditLog } from "../utils/auditLogger.js";

const ALLOWED_VENDOR_STATUS = ["active", "inactive"];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[6-9]\d{9}$/;
const GST_REGEX =
  /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const NAME_REGEX = /^[a-zA-Z0-9\s.&'(),-]+$/;

const getUserAgent = (req) => req.headers["user-agent"] || null;

const normalizeText = (value) => {
  if (value === undefined || value === null) return "";
  return String(value).replace(/<[^>]*>?/gm, "").trim();
};

const normalizeNullable = (value) => {
  const text = normalizeText(value);
  return text || null;
};

const normalizeEmail = (email) => normalizeText(email).toLowerCase();
const normalizeUpper = (value) => normalizeText(value).toUpperCase();

const toNumber = (value, fallback = 0) => {
  if (value === undefined || value === null || value === "") return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : NaN;
};

const isPositiveInteger = (value) => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0;
};

const clampPagination = (value, fallback, max) => {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) return fallback;
  return Math.min(number, max);
};

const validateVendorPayload = ({
  vendor_name,
  company_name,
  email,
  phone,
  gstin,
  billing_address,
  address,
  opening_balance,
  notes,
  status,
}) => {
  const vendorName = normalizeText(vendor_name);
  const companyName = normalizeText(company_name);
  const vendorEmail = normalizeEmail(email);
  const vendorPhone = normalizeText(phone);
  const vendorGstin = normalizeUpper(gstin);
  const finalBillingAddress =
    normalizeText(billing_address) || normalizeText(address);
  const openingBalance = toNumber(opening_balance);
  const vendorNotes = normalizeText(notes);
  const vendorStatus = normalizeText(status).toLowerCase() || "active";

  if (!vendorName) return "Vendor name is required";

  if (vendorName.length < 2 || vendorName.length > 100) {
    return "Vendor name must be between 2 and 100 characters";
  }

  if (!NAME_REGEX.test(vendorName)) {
    return "Vendor name contains invalid characters";
  }

  if (companyName && companyName.length > 100) {
    return "Company name must be less than 100 characters";
  }

  if (companyName && !NAME_REGEX.test(companyName)) {
    return "Company name contains invalid characters";
  }

  if (vendorEmail && !EMAIL_REGEX.test(vendorEmail)) {
    return "Invalid vendor email format";
  }

  if (vendorPhone && !PHONE_REGEX.test(vendorPhone)) {
    return "Phone must be a valid 10 digit Indian mobile number";
  }

  if (vendorGstin && !GST_REGEX.test(vendorGstin)) {
    return "Invalid GST number format";
  }

  if (finalBillingAddress && finalBillingAddress.length > 500) {
    return "Billing address must be less than 500 characters";
  }

  if (Number.isNaN(openingBalance)) {
    return "Opening balance must be a valid number";
  }

  if (openingBalance < 0) {
    return "Opening balance cannot be negative";
  }

  if (vendorNotes && vendorNotes.length > 500) {
    return "Notes must be less than 500 characters";
  }

  if (!ALLOWED_VENDOR_STATUS.includes(vendorStatus)) {
    return "Status must be active or inactive";
  }

  return null;
};

const normalizeVendorPayload = (body) => ({
  vendor_name: normalizeText(body.vendor_name),
  company_name: normalizeNullable(body.company_name),
  email: normalizeEmail(body.email) || null,
  phone: normalizeNullable(body.phone),
  gstin: normalizeUpper(body.gstin) || null,
  billing_address:
    normalizeNullable(body.billing_address) || normalizeNullable(body.address),
  opening_balance: toNumber(body.opening_balance),
  notes: normalizeNullable(body.notes),
  status: normalizeText(body.status).toLowerCase() || "active",
});

const getVendorById = async (id, company_id) => {
  if (!isPositiveInteger(id)) return null;

  const [vendors] = await db.query(
    `
    SELECT *
    FROM tbl_vendors
    WHERE id = ?
    AND company_id = ?
    LIMIT 1
    `,
    [id, company_id],
  );

  return vendors[0] || null;
};

const checkDuplicateVendor = async ({
  companyId,
  email,
  gstin,
  excludeVendorId = null,
}) => {
  if (!email && !gstin) return null;

  const params = [companyId];
  const conditions = [];

  let query = `
    SELECT id, email, gstin
    FROM tbl_vendors
    WHERE company_id = ?
    AND (
  `;

  if (email) {
    conditions.push("email = ?");
    params.push(email);
  }

  if (gstin) {
    conditions.push("gstin = ?");
    params.push(gstin);
  }

  query += conditions.join(" OR ");
  query += ")";

  if (excludeVendorId) {
    query += " AND id != ?";
    params.push(excludeVendorId);
  }

  query += " LIMIT 1";

  const [rows] = await db.query(query, params);

  if (rows.length === 0) return null;

  const duplicate = rows[0];

  if (email && duplicate.email === email) {
    return "Vendor email already exists";
  }

  if (gstin && duplicate.gstin === gstin) {
    return "GST number already exists for another vendor";
  }

  return "Vendor already exists";
};

// CREATE VENDOR
export const createVendor = async (req, res) => {
  try {
    const company_id = req.user.company_id;

    if (!company_id) {
      return res.status(400).json({ message: "Company id missing" });
    }

    const validationError = validateVendorPayload(req.body);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const payload = normalizeVendorPayload(req.body);

    const duplicateError = await checkDuplicateVendor({
      companyId: company_id,
      email: payload.email,
      gstin: payload.gstin,
    });

    if (duplicateError) {
      return res.status(409).json({ message: duplicateError });
    }

    const [vendorResult] = await db.query(
      `
      INSERT INTO tbl_vendors
      (
        company_id,
        vendor_name,
        company_name,
        email,
        phone,
        gstin,
        billing_address,
        opening_balance,
        notes,
        status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        company_id,
        payload.vendor_name,
        payload.company_name,
        payload.email,
        payload.phone,
        payload.gstin,
        payload.billing_address,
        payload.opening_balance,
        payload.notes,
        payload.status,
      ],
    );

    const vendor = await getVendorById(vendorResult.insertId, company_id);

    await createAuditLog({
      company_id,
      user_id: req.user.id,
      role: req.user.role,
      action: "CREATE",
      module_name: "Vendor",
      record_id: vendorResult.insertId,
      description: `Vendor ${payload.vendor_name} created`,
      ip_address: req.ip,
      user_agent: getUserAgent(req),
    });

    return res.status(201).json({
      message: "Vendor created successfully",
      vendor,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Create vendor error",
      error: error.message,
    });
  }
};

// GET VENDORS
export const getVendors = async (req, res) => {
  try {
    const company_id = req.user.company_id;

    if (!company_id) {
      return res.status(400).json({ message: "Company id missing" });
    }

    const page = clampPagination(req.query.page, 1, 100000);
    const limit = clampPagination(req.query.limit, 1000, 1000);
    const offset = (page - 1) * limit;

    const search = normalizeText(req.query.search);
    const status = normalizeText(req.query.status).toLowerCase() || "all";

    if (status !== "all" && !ALLOWED_VENDOR_STATUS.includes(status)) {
      return res.status(400).json({
        message: "Status must be all, active or inactive",
      });
    }

    let whereClause = "WHERE company_id = ?";
    const params = [company_id];

    if (search) {
      whereClause += `
        AND (
          vendor_name LIKE ?
          OR company_name LIKE ?
          OR email LIKE ?
          OR phone LIKE ?
          OR gstin LIKE ?
          OR billing_address LIKE ?
        )
      `;

      const keyword = `%${search}%`;
      params.push(keyword, keyword, keyword, keyword, keyword, keyword);
    }

    if (status !== "all") {
      whereClause += " AND status = ?";
      params.push(status);
    }

    const [countRows] = await db.query(
      `
      SELECT COUNT(*) AS total
      FROM tbl_vendors
      ${whereClause}
      `,
      params,
    );

    const total = Number(countRows[0]?.total || 0);
    const totalPages = Math.ceil(total / limit);

    const [vendors] = await db.query(
      `
      SELECT *
      FROM tbl_vendors
      ${whereClause}
      ORDER BY id DESC
      LIMIT ? OFFSET ?
      `,
      [...params, limit, offset],
    );

    return res.json({
      vendors,
      total,
      page,
      limit,
      totalPages,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Get vendors error",
      error: error.message,
    });
  }
};

// GET SINGLE VENDOR
export const getSingleVendor = async (req, res) => {
  try {
    const company_id = req.user.company_id;
    const { id } = req.params;

    if (!company_id) {
      return res.status(400).json({ message: "Company id missing" });
    }

    if (!isPositiveInteger(id)) {
      return res.status(400).json({ message: "Valid vendor id is required" });
    }

    const vendor = await getVendorById(id, company_id);

    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    return res.json(vendor);
  } catch (error) {
    return res.status(500).json({
      message: "Get vendor error",
      error: error.message,
    });
  }
};

// UPDATE VENDOR
export const updateVendor = async (req, res) => {
  try {
    const company_id = req.user.company_id;
    const { id } = req.params;

    if (!company_id) {
      return res.status(400).json({ message: "Company id missing" });
    }

    if (!isPositiveInteger(id)) {
      return res.status(400).json({ message: "Valid vendor id is required" });
    }

    const validationError = validateVendorPayload(req.body);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const existingVendor = await getVendorById(id, company_id);

    if (!existingVendor) {
      return res.status(404).json({
        message: "Vendor not found or not allowed",
      });
    }

    const payload = normalizeVendorPayload(req.body);

    const duplicateError = await checkDuplicateVendor({
      companyId: company_id,
      email: payload.email,
      gstin: payload.gstin,
      excludeVendorId: id,
    });

    if (duplicateError) {
      return res.status(409).json({ message: duplicateError });
    }

    const [result] = await db.query(
      `
      UPDATE tbl_vendors
      SET
        vendor_name = ?,
        company_name = ?,
        email = ?,
        phone = ?,
        gstin = ?,
        billing_address = ?,
        opening_balance = ?,
        notes = ?,
        status = ?
      WHERE id = ? AND company_id = ?
      `,
      [
        payload.vendor_name,
        payload.company_name,
        payload.email,
        payload.phone,
        payload.gstin,
        payload.billing_address,
        payload.opening_balance,
        payload.notes,
        payload.status,
        id,
        company_id,
      ],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Vendor not found or not allowed",
      });
    }

    const vendor = await getVendorById(id, company_id);

    await createAuditLog({
      company_id,
      user_id: req.user.id,
      role: req.user.role,
      action: "UPDATE",
      module_name: "Vendor",
      record_id: id,
      description: `Vendor ${payload.vendor_name} updated`,
      ip_address: req.ip,
      user_agent: getUserAgent(req),
    });

    return res.json({
      message: "Vendor updated successfully",
      vendor,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Update vendor error",
      error: error.message,
    });
  }
};

// DELETE / DEACTIVATE VENDOR
export const deleteVendor = async (req, res) => {
  try {
    const company_id = req.user.company_id;
    const { id } = req.params;

    if (!company_id) {
      return res.status(400).json({ message: "Company id missing" });
    }

    if (!isPositiveInteger(id)) {
      return res.status(400).json({ message: "Valid vendor id is required" });
    }

    const vendor = await getVendorById(id, company_id);

    if (!vendor) {
      return res.status(404).json({
        message: "Vendor not found or not allowed",
      });
    }

    if (vendor.status === "inactive") {
      return res.status(400).json({
        message: "Vendor already inactive",
      });
    }

    const [result] = await db.query(
      `
      UPDATE tbl_vendors
      SET status = 'inactive'
      WHERE id = ?
      AND company_id = ?
      `,
      [id, company_id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Vendor not found or not allowed",
      });
    }

    await createAuditLog({
      company_id,
      user_id: req.user.id,
      role: req.user.role,
      action: "DELETE",
      module_name: "Vendor",
      record_id: id,
      description: `Vendor ${vendor.vendor_name} deactivated`,
      ip_address: req.ip,
      user_agent: getUserAgent(req),
    });

    return res.json({
      message: "Vendor deactivated successfully",
    });
  } catch (error) {
    return res.status(500).json({
      message: "Delete vendor error",
      error: error.message,
    });
  }
};