import db from "../config/db.js";
import transporter from "../utils/emailService.js";
import { createAuditLog } from "../utils/auditLogger.js";

const REQUIRED_DOCUMENTS = ["aadhaar_card", "pan_card"];

const OPTIONAL_DOCUMENTS = ["gst_certificate", "tan_document"];
const ALL_DOCUMENTS = [...REQUIRED_DOCUMENTS, ...OPTIONAL_DOCUMENTS];

const getFilePath = (file) => {
  if (!file?.filename) return null;
  return `/upload/kyc-documents/${file.filename}`;
};

const getCompanyAdmin = async (companyId) => {
  const [rows] = await db.query(
    `
    SELECT id, name, email
    FROM tbl_users
    WHERE company_id = ?
    AND role = 'company_admin'
    LIMIT 1
    `,
    [companyId],
  );

  return rows[0] || null;
};

const sendKycApprovedEmail = async (email, name) => {
  if (!email) return;

  await transporter.sendMail({
    to: email,
    subject: "Your Company Account Has Been Verified",
    html: `
      <p>Hello ${name || "Company Admin"},</p>
      <p>Your company KYC has been successfully verified.</p>
      <p>Your account is now active. You can login and use the platform.</p>
      <p>Thank you.</p>
    `,
  });
};

const sendKycRejectedEmail = async (email, name, reason) => {
  if (!email) return;

  await transporter.sendMail({
    to: email,
    subject: "Your Company KYC Has Been Rejected",
    html: `
      <p>Hello ${name || "Company Admin"},</p>
      <p>Your company KYC verification has been rejected.</p>
      <p><b>Reason:</b> ${reason || "Documents could not be verified."}</p>
      <p>Please contact Super Admin for further support.</p>
    `,
  });
};

export const getMyKycStatus = async (req, res) => {
  try {
    const companyId = req.user.company_id;

    if (!companyId) {
      return res.status(400).json({ message: "Company id missing" });
    }

    const [companies] = await db.query(
      `
      SELECT
  id,
  name,
  email,
  status,
  aadhaar_verified,
  pan_verified,
  gst_verified,
  kyc_status,
  kyc_attempts,
  kyc_verified_at,
  kyc_rejection_reason
FROM tbl_companies
WHERE id = ?
LIMIT 1
      `,
      [companyId],
    );

    if (companies.length === 0) {
      return res.status(404).json({ message: "Company not found" });
    }

    const [documents] = await db.query(
      `
      SELECT
        id,
        document_type,
        document_path,
        verification_status,
        uploaded_by_role,
        is_manual_upload,
        created_at
      FROM tbl_company_kyc_documents
      WHERE company_id = ?
      ORDER BY id DESC
      `,
      [companyId],
    );

    return res.json({
      company: companies[0],
      documents,
      attempts_left: Math.max(0, 3 - Number(companies[0].kyc_attempts || 0)),
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch KYC status",
      error: error.message,
    });
  }
};

const createTrialSubscription = async (connection, companyId) => {
  const [existing] = await connection.query(
    `
    SELECT id
    FROM tbl_company_subscriptions
    WHERE company_id = ?
    AND status IN ('trial','active','pending_payment')
    LIMIT 1
    `,
    [companyId],
  );

  if (existing.length) return;

  const [trialPlan] = await connection.query(
    `
    SELECT id
    FROM tbl_subscription_plans
    WHERE LOWER(plan_name) = 'free trial'
    LIMIT 1
    `,
  );

  if (!trialPlan.length) return;

  await connection.query(
    `
    INSERT INTO tbl_company_subscriptions
    (
      company_id,
      plan_id,
      status,
      start_date,
      trial_end_date,
      auto_renewal
    )
    VALUES
    (
      ?,
      ?,
      'trial',
      CURDATE(),
      DATE_ADD(CURDATE(), INTERVAL 10 DAY),
      0
    )
    `,
    [companyId, trialPlan[0].id],
  );
};

export const uploadCompanyKycDocuments = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const companyId = req.user.company_id;
    const userId = req.user.id;

    if (!companyId) {
      return res.status(400).json({ message: "Company id missing" });
    }

    const [companyRows] = await connection.query(
      `
      SELECT id, status, kyc_status, kyc_attempts
      FROM tbl_companies
      WHERE id = ?
      LIMIT 1
      `,
      [companyId],
    );

    if (companyRows.length === 0) {
      return res.status(404).json({ message: "Company not found" });
    }

    const company = companyRows[0];

    if (
      company.kyc_status === "approved" ||
      company.kyc_status === "manual_verified"
    ) {
      return res.status(400).json({ message: "KYC already verified" });
    }

    if (
      company.kyc_status === "blocked" ||
      Number(company.kyc_attempts || 0) >= 3
    ) {
      return res.status(403).json({
        message: "KYC attempts exhausted. Please contact Super Admin.",
      });
    }

    const files = req.files || {};

    for (const docType of REQUIRED_DOCUMENTS) {
      if (!files[docType]?.[0]) {
        return res.status(400).json({
          message: `${docType.replace("_", " ")} is required`,
        });
      }
    }

    await connection.beginTransaction();

    for (const docType of ALL_DOCUMENTS) {
      const file = files[docType]?.[0];
      if (!file) continue;

      await connection.query(
        `
        INSERT INTO tbl_company_kyc_documents
        (
          company_id,
          document_type,
          document_path,
          verification_status,
          uploaded_by_user_id,
          uploaded_by_role,
          is_manual_upload
        )
        VALUES (?, ?, ?, 'pending', ?, 'company_admin', 0)
        `,
        [companyId, docType, getFilePath(file), userId],
      );
    }

    await connection.query(
      `
      UPDATE tbl_companies
      SET kyc_status =
CASE
  WHEN kyc_status = 'pending'
  THEN 'submitted'
  ELSE kyc_status
END
      WHERE id = ?
      `,
      [companyId],
    );

    await connection.query(
      `
      INSERT INTO tbl_kyc_verification_logs
      (company_id, action, remarks, performed_by, performed_role)
      VALUES (?, 'KYC_DOCUMENTS_UPLOADED', 'Company Admin uploaded KYC documents', ?, 'company_admin')
      `,
      [companyId, userId],
    );

    await createAuditLog({
      company_id: companyId,
      user_id: userId,
      role: "company_admin",
      action: "KYC_DOCUMENTS_UPLOADED",
      module_name: "KYC",
      record_id: companyId,
      description: "Company Admin uploaded KYC documents",
      ip_address: req.ip,
      user_agent: req.headers["user-agent"] || null,
    });

    const [readyRows] = await connection.query(
      `
  SELECT aadhaar_verified, pan_verified
  FROM tbl_companies
  WHERE id = ?
  LIMIT 1
  `,
      [companyId],
    );

    const [docRows] = await connection.query(
      `
  SELECT COUNT(DISTINCT document_type) AS total_docs
  FROM tbl_company_kyc_documents
  WHERE company_id = ?
  AND document_type IN ('aadhaar_card', 'pan_card')
  `,
      [companyId],
    );

    const isReadyForApproval =
      Number(readyRows[0]?.aadhaar_verified || 0) === 1 &&
      Number(readyRows[0]?.pan_verified || 0) === 1 &&
      Number(docRows[0]?.total_docs || 0) >= 2;

    if (isReadyForApproval) {
      await connection.query(
        `
    UPDATE tbl_companies
    SET
      status = 'active',
      kyc_status = 'approved',
      kyc_attempts = 0,
      kyc_verified_at = NOW(),
      kyc_verified_by = NULL,
      kyc_rejection_reason = NULL
    WHERE id = ?
    `,
        [companyId],
      );

      await connection.query(
        `
    UPDATE tbl_users
    SET status = 'active'
    WHERE company_id = ?
    AND role = 'company_admin'
    `,
        [companyId],
      );

      await connection.query(
        `
    UPDATE tbl_company_kyc_documents
    SET verification_status = 'verified'
    WHERE company_id = ?
    AND document_type IN ('aadhaar_card', 'pan_card')
    `,
        [companyId],
      );

      await createTrialSubscription(connection, companyId);
    }
    await connection.commit();

    return res.json({
      message: isReadyForApproval
        ? "KYC completed successfully. Please login."
        : "KYC documents uploaded successfully",
      approved: isReadyForApproval,
    });
  } catch (error) {
    await connection.rollback();

    return res.status(500).json({
      message: "Failed to upload KYC documents",
      error: error.message,
    });
  } finally {
    connection.release();
  }
};

export const getAllKycRequests = async (req, res) => {
  try {
    const { status = "all" } = req.query;

    const params = [];
    let whereClause = `
      WHERE c.kyc_status IS NOT NULL
    `;

    if (status !== "all") {
      whereClause += " AND c.kyc_status = ? ";
      params.push(status);
    }

    const [rows] = await db.query(
      `
      SELECT
        c.id AS company_id,
        c.name AS company_name,
        c.email AS company_email,
        c.status AS company_status,
        c.kyc_status,
        c.kyc_attempts,
        c.kyc_rejection_reason,
        c.created_at,
        u.name AS admin_name,
        u.email AS admin_email,
        COUNT(d.id) AS document_count
      FROM tbl_companies c
      LEFT JOIN tbl_users u
        ON u.company_id = c.id
        AND u.role = 'company_admin'
      LEFT JOIN tbl_company_kyc_documents d
        ON d.company_id = c.id
      ${whereClause}
      GROUP BY c.id, u.id
      ORDER BY c.id DESC
      `,
      params,
    );

    return res.json(rows);
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch KYC requests",
      error: error.message,
    });
  }
};

export const getKycRequestByCompany = async (req, res) => {
  try {
    const { companyId } = req.params;

    const [companies] = await db.query(
      `
      SELECT
        c.*,
        u.name AS admin_name,
        u.email AS admin_email
      FROM tbl_companies c
      LEFT JOIN tbl_users u
        ON u.company_id = c.id
        AND u.role = 'company_admin'
      WHERE c.id = ?
      LIMIT 1
      `,
      [companyId],
    );

    if (companies.length === 0) {
      return res.status(404).json({ message: "Company not found" });
    }

    const [documents] = await db.query(
      `
      SELECT *
      FROM tbl_company_kyc_documents
      WHERE company_id = ?
      ORDER BY id DESC
      `,
      [companyId],
    );

    const [logs] = await db.query(
      `
      SELECT *
      FROM tbl_kyc_verification_logs
      WHERE company_id = ?
      ORDER BY id DESC
      `,
      [companyId],
    );

    return res.json({
      company: companies[0],
      documents,
      logs,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch KYC request detail",
      error: error.message,
    });
  }
};

export const uploadSuperAdminKycDocuments = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const { companyId } = req.params;
    const userId = req.user.id;
    const files = req.files || {};

    if (!companyId) {
      return res.status(400).json({ message: "Company id missing" });
    }

    const [companyRows] = await connection.query(
      `
      SELECT id
      FROM tbl_companies
      WHERE id = ?
      LIMIT 1
      `,
      [companyId],
    );

    if (companyRows.length === 0) {
      return res.status(404).json({ message: "Company not found" });
    }

    const uploadedDocs = ALL_DOCUMENTS.filter((docType) => files[docType]?.[0]);

    if (uploadedDocs.length === 0) {
      return res
        .status(400)
        .json({ message: "Please upload at least one document" });
    }

    await connection.beginTransaction();

    for (const docType of uploadedDocs) {
      const file = files[docType]?.[0];

      await connection.query(
        `
        INSERT INTO tbl_company_kyc_documents
        (
          company_id,
          document_type,
          document_path,
          verification_status,
          uploaded_by_user_id,
          uploaded_by_role,
          is_manual_upload
        )
        VALUES (?, ?, ?, 'verified', ?, 'superadmin', 1)
        `,
        [companyId, docType, getFilePath(file), userId],
      );
    }

    await connection.query(
      `
      INSERT INTO tbl_kyc_verification_logs
      (company_id, action, remarks, performed_by, performed_role)
      VALUES (?, 'SUPERADMIN_DOCUMENTS_UPLOADED', 'SuperAdmin manually uploaded KYC documents', ?, 'superadmin')
      `,
      [companyId, userId],
    );

    const [readyRows] = await connection.query(
      `
  SELECT
    aadhaar_verified,
    pan_verified
  FROM tbl_companies
  WHERE id = ?
  LIMIT 1
  `,
      [companyId],
    );

    const [docRows] = await connection.query(
      `
  SELECT COUNT(DISTINCT document_type) AS total_docs
  FROM tbl_company_kyc_documents
  WHERE company_id = ?
  AND document_type IN ('aadhaar_card','pan_card')
  `,
      [companyId],
    );

    const isManualKycReady =
      Number(readyRows[0]?.aadhaar_verified || 0) === 1 &&
      Number(readyRows[0]?.pan_verified || 0) === 1 &&
      Number(docRows[0]?.total_docs || 0) >= 2;

    if (isManualKycReady) {
      await connection.query(
        `
    UPDATE tbl_companies
    SET
      status = 'active',
      kyc_status = 'manual_verified',
      kyc_attempts = 0,
      kyc_verified_at = NOW(),
      kyc_verified_by = ?,
      kyc_rejection_reason = NULL
    WHERE id = ?
    `,
        [userId, companyId],
      );

      await connection.query(
        `
    UPDATE tbl_users
    SET status = 'active'
    WHERE company_id = ?
    AND role = 'company_admin'
    `,
        [companyId],
      );

      await connection.query(
        `
    UPDATE tbl_company_kyc_documents
    SET verification_status = 'verified'
    WHERE company_id = ?
    `,
        [companyId],
      );

      await createTrialSubscription(connection, companyId);
    }

    await createAuditLog({
      company_id: Number(companyId),
      user_id: userId,
      role: "superadmin",
      action: "SUPERADMIN_DOCUMENTS_UPLOADED",
      module_name: "KYC",
      record_id: companyId,
      description: "SuperAdmin uploaded KYC documents",
      ip_address: req.ip,
      user_agent: req.headers["user-agent"] || null,
    });

    await connection.commit();

    return res.json({
      message: "SuperAdmin KYC documents uploaded successfully",
    });
  } catch (error) {
    await connection.rollback();

    return res.status(500).json({
      message: "Failed to upload SuperAdmin KYC documents",
      error: error.message,
    });
  } finally {
    connection.release();
  }
};

export const rejectKyc = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const { companyId } = req.params;
    const userId = req.user.id;
    const { reason } = req.body;

    if (!reason?.trim()) {
      return res.status(400).json({ message: "Rejection reason is required" });
    }

    await connection.beginTransaction();

    const [companies] = await connection.query(
      `
      SELECT id, name
      FROM tbl_companies
      WHERE id = ?
      LIMIT 1
      `,
      [companyId],
    );

    if (companies.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: "Company not found" });
    }

    await connection.query(
      `
      UPDATE tbl_companies
      SET status = 'inactive',
          kyc_status = 'rejected',
          kyc_rejection_reason = ?
      WHERE id = ?
      `,
      [reason.trim(), companyId],
    );

    await connection.query(
      `
      UPDATE tbl_users
      SET status = 'inactive'
      WHERE company_id = ?
      AND role = 'company_admin'
      `,
      [companyId],
    );

    await connection.query(
      `
      INSERT INTO tbl_kyc_verification_logs
      (company_id, action, remarks, performed_by, performed_role)
      VALUES (?, 'KYC_REJECTED', ?, ?, 'superadmin')
      `,
      [companyId, reason.trim(), userId],
    );

    await connection.commit();

    const admin = await getCompanyAdmin(companyId);
    await sendKycRejectedEmail(admin?.email, admin?.name, reason.trim());

    await createAuditLog({
      company_id: Number(companyId),
      user_id: userId,
      role: "superadmin",
      action: "KYC_REJECTED",
      module_name: "KYC",
      record_id: companyId,
      description: `SuperAdmin rejected KYC for company ${companies[0].name}`,
      ip_address: req.ip,
      user_agent: req.headers["user-agent"] || null,
    });

    return res.json({
      message: "KYC rejected successfully",
    });
  } catch (error) {
    await connection.rollback();

    return res.status(500).json({
      message: "Failed to reject KYC",
      error: error.message,
    });
  } finally {
    connection.release();
  }
};

export const unblockCompany = async (req, res) => {
  try {
    const { companyId } = req.params;
    const userId = req.user.id;

    await db.query(
      `
      UPDATE tbl_companies
      SET
        status = 'inactive',
        kyc_status = 'pending',
        kyc_attempts = 0,
        kyc_rejection_reason = NULL,
        aadhaar_verified = 0,
        pan_verified = 0,
        gst_verified = 0,
        kyc_verified_at = NULL,
        kyc_verified_by = NULL
      WHERE id = ?
      `,
      [companyId],
    );

    await db.query(
      `
      UPDATE tbl_users
      SET status = 'inactive'
      WHERE company_id = ?
      AND role = 'company_admin'
      `,
      [companyId],
    );

    await db.query(
      `
      INSERT INTO tbl_kyc_verification_logs
      (company_id, action, remarks, performed_by, performed_role)
      VALUES (?, 'KYC_COMPANY_UNBLOCKED', 'Company unblocked for fresh KYC by SuperAdmin', ?, 'superadmin')
      `,
      [companyId, userId],
    );

    await createAuditLog({
      company_id: Number(companyId),
      user_id: userId,
      role: "superadmin",
      action: "KYC_COMPANY_UNBLOCKED",
      module_name: "KYC",
      record_id: companyId,
      description: "SuperAdmin unblocked company for fresh KYC",
      ip_address: req.ip,
      user_agent: req.headers["user-agent"] || null,
    });

    return res.json({
      message: "Company unblocked successfully",
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to unblock company",
      error: error.message,
    });
  }
};
