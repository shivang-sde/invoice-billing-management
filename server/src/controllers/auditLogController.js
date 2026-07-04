import db from "../config/db.js";

const toSafeLimit = (limit) => {
  const number = Number(limit);
  if (!Number.isFinite(number)) return 20;
  return Math.min(Math.max(number, 1), 100);
};

const toSafePage = (page) => {
  const number = Number(page);
  if (!Number.isFinite(number)) return 1;
  return Math.max(number, 1);
};

const normalizeText = (value) => {
  return value ? String(value).trim() : "";
};

const applyAuditFilters = ({ query, params, role, company_id, filters }) => {
  const {
    search = "",
    action = "",
    module_name = "",
    user_id = "",
    company_filter_id = "",
    role_filter = "",
    from_date = "",
    to_date = "",
  } = filters;

  const keyword = normalizeText(search);
  const finalAction = normalizeText(action);
  const finalModuleName = normalizeText(module_name);
  const finalUserId = normalizeText(user_id);
  const finalCompanyFilterId = normalizeText(company_filter_id);
  const finalRoleFilter = normalizeText(role_filter);
  const finalFromDate = normalizeText(from_date);
  const finalToDate = normalizeText(to_date);

  if (role !== "superadmin") {
    query += ` AND al.company_id = ?`;
    params.push(company_id);
  }

  if (role === "superadmin" && finalCompanyFilterId) {
    query += ` AND al.company_id = ?`;
    params.push(finalCompanyFilterId);
  }

  if (keyword) {
    query += `
      AND (
        al.action LIKE ?
        OR al.module_name LIKE ?
        OR al.description LIKE ?
        OR al.role LIKE ?
        OR al.ip_address LIKE ?
        OR al.user_agent LIKE ?
        OR u.name LIKE ?
        OR u.email LIKE ?
        OR c.name LIKE ?
      )
    `;

    const likeKeyword = `%${keyword}%`;
    params.push(
      likeKeyword,
      likeKeyword,
      likeKeyword,
      likeKeyword,
      likeKeyword,
      likeKeyword,
      likeKeyword,
      likeKeyword,
      likeKeyword,
    );
  }

  if (finalAction) {
    query += ` AND al.action = ?`;
    params.push(finalAction);
  }

  if (finalModuleName) {
    query += ` AND al.module_name = ?`;
    params.push(finalModuleName);
  }

  if (finalUserId) {
    query += ` AND al.user_id = ?`;
    params.push(finalUserId);
  }

  if (finalRoleFilter) {
    query += ` AND al.role = ?`;
    params.push(finalRoleFilter);
  }

  if (finalFromDate) {
    query += ` AND DATE(al.created_at) >= ?`;
    params.push(finalFromDate);
  }

  if (finalToDate) {
    query += ` AND DATE(al.created_at) <= ?`;
    params.push(finalToDate);
  }

  return { query, params };
};

const escapeCSV = (value) => {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
};

export const getAuditLogs = async (req, res) => {
  try {
    const { role, company_id } = req.user;
    const { limit = 20, page = 1 } = req.query;

    const safeLimit = toSafeLimit(limit);
    const safePage = toSafePage(page);
    const offset = (safePage - 1) * safeLimit;

    if (role !== "superadmin" && !company_id) {
      return res.status(400).json({ message: "Company id missing" });
    }

    let baseQuery = `
      FROM tbl_audit_logs al
      LEFT JOIN tbl_users u ON al.user_id = u.id
      LEFT JOIN tbl_companies c ON al.company_id = c.id
      WHERE 1=1
    `;

    let params = [];

    const filtered = applyAuditFilters({
      query: baseQuery,
      params,
      role,
      company_id,
      filters: req.query,
    });

    baseQuery = filtered.query;
    params = filtered.params;

    const countQuery = `
      SELECT COUNT(*) AS total
      ${baseQuery}
    `;

    const [countRows] = await db.query(countQuery, params);
    const total = Number(countRows[0]?.total || 0);
    const totalPages = Math.max(Math.ceil(total / safeLimit), 1);

    const dataQuery = `
      SELECT 
        al.id,
        al.company_id,
        al.user_id,
        al.role,
        al.action,
        al.module_name,
        al.record_id,
        al.description,
        al.ip_address,
        al.user_agent,
        al.created_at,
        u.name AS user_name,
        u.email AS user_email,
        c.name AS company_name
      ${baseQuery}
      ORDER BY al.id DESC
      LIMIT ? OFFSET ?
    `;

    const [logs] = await db.query(dataQuery, [
      ...params,
      safeLimit,
      offset,
    ]);

    return res.json({
      logs,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages,
      },
    });
  } catch (error) {
    console.log("GET AUDIT LOGS ERROR:", error);
    return res.status(500).json({
      message: "Failed to fetch audit logs",
      error: error.message,
    });
  }
};

export const exportAuditLogsCSV = async (req, res) => {
  try {
    const { role, company_id } = req.user;

    if (role !== "superadmin" && !company_id) {
      return res.status(400).json({ message: "Company id missing" });
    }

    let query = `
      SELECT 
        al.id,
        al.company_id,
        al.user_id,
        al.role,
        al.action,
        al.module_name,
        al.record_id,
        al.description,
        al.ip_address,
        al.user_agent,
        al.created_at,
        u.name AS user_name,
        u.email AS user_email,
        c.name AS company_name
      FROM tbl_audit_logs al
      LEFT JOIN tbl_users u ON al.user_id = u.id
      LEFT JOIN tbl_companies c ON al.company_id = c.id
      WHERE 1=1
    `;

    let params = [];

    const filtered = applyAuditFilters({
      query,
      params,
      role,
      company_id,
      filters: req.query,
    });

    query = filtered.query;
    params = filtered.params;

    query += ` ORDER BY al.id DESC`;

    const [logs] = await db.query(query, params);

    const headers = [
      "ID",
      "Company",
      "User",
      "Email",
      "Role",
      "Action",
      "Module",
      "Record ID",
      "Description",
      "IP Address",
      "User Agent",
      "Created At",
    ];

    const rows = logs.map((log) => [
      log.id,
      log.company_name || "",
      log.user_name || "",
      log.user_email || "",
      log.role || "",
      log.action || "",
      log.module_name || "",
      log.record_id || "",
      log.description || "",
      log.ip_address || "",
      log.user_agent || "",
      log.created_at || "",
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map(escapeCSV).join(","))
      .join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=audit-logs.csv");

    return res.send(csv);
  } catch (error) {
    console.log("EXPORT AUDIT LOGS ERROR:", error);
    return res.status(500).json({
      message: "Failed to export audit logs",
      error: error.message,
    });
  }
};