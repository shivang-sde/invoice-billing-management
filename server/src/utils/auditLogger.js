import db from "../config/db.js";

export const createAuditLog = async ({
  company_id = null,
  user_id = null,
  role = null,
  action,
  module_name,
  record_id = null,
  description = "",
  ip_address = null,
  user_agent = null,
}) => {
  try {
    if (!action || !module_name) return;

    await db.query(
      `
      INSERT INTO tbl_audit_logs
      (
        company_id,
        user_id,
        role,
        action,
        module_name,
        record_id,
        description,
        ip_address,
        user_agent
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        company_id,
        user_id,
        role,
        action,
        module_name,
        record_id,
        description,
        ip_address,
        user_agent,
      ],
    );
  } catch (error) {
    console.log("AUDIT LOG ERROR:", error.message);
  }
};
