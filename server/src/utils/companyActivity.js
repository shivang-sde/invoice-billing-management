import db from "../config/db.js";

export const updateCompanyActivity = async (company_id) => {
  if (!company_id) return;

  await db.query(
    `
    UPDATE tbl_companies
    SET last_activity_at = NOW()
    WHERE id = ?
    `,
    [company_id],
  );
};