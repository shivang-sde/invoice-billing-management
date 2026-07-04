import { emitNotificationUpdate, emitCustomerNotification } from "./socketEvents.js";

const ALLOWED_TYPES = [
  "security",
  "user",
  "company",
  "subscription",
  "system",
  "invoice",
  "payment",
  "quotation",
];

const ALLOWED_SEVERITY = ["low", "medium", "high", "critical"];

const normalizeText = (value) => String(value || "").trim();

const getActiveUsersByRoles = async (
  connection,
  company_id,
  roles = [],
  exclude_user_id = null,
) => {
  if (!company_id || roles.length === 0) return [];

  const placeholders = roles.map(() => "?").join(",");
  const params = [company_id, ...roles];

  let excludeClause = "";

  if (exclude_user_id) {
    excludeClause = "AND id != ?";
    params.push(exclude_user_id);
  }

  const [users] = await connection.query(
    `
    SELECT id, role
    FROM tbl_users
    WHERE company_id = ?
    AND status = 'active'
    AND role IN (${placeholders})
    ${excludeClause}
    `,
    params,
  );

  return users;
};

export const createNotification = async ({
  connection,
  company_id = null,
  user_id = null,
  type = "system",
  severity = "medium",
  title,
  message,
}) => {
  if (!connection) {
    throw new Error("Database connection is required");
  }

  if (!normalizeText(title) || !normalizeText(message)) {
    return null;
  }

  const safeType = ALLOWED_TYPES.includes(String(type).toLowerCase())
    ? String(type).toLowerCase()
    : "system";

  const safeSeverity = ALLOWED_SEVERITY.includes(String(severity).toLowerCase())
    ? String(severity).toLowerCase()
    : "medium";

  const [result] = await connection.query(
    `
    INSERT INTO tbl_notifications
    (company_id, user_id, type, severity, title, message)
    VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      company_id,
      user_id,
      safeType,
      safeSeverity,
      normalizeText(title),
      normalizeText(message),
    ],
  );

  const notification = {
    id: result.insertId,
    company_id,
    user_id,
    type: safeType,
    severity: safeSeverity,
    title: normalizeText(title),
    message: normalizeText(message),
    is_read: 0,
    created_at: new Date(),
  };

  emitNotificationUpdate({
    company_id,
    user_id,
  });

  if (user_id) {
    emitCustomerNotification({
      user_id,
      notification,
    });
  }

  return notification;
};

export const notifyUsersByRoles = async ({
  connection,
  company_id,
  roles = [],
  exclude_user_id = null,
  type = "system",
  severity = "medium",
  title,
  message,
}) => {
  if (!connection) {
    throw new Error("Database connection is required");
  }

  const users = await getActiveUsersByRoles(
    connection,
    company_id,
    roles,
    exclude_user_id,
  );

  const notifications = [];

  for (const user of users) {
    const notification = await createNotification({
      connection,
      company_id,
      user_id: user.id,
      type,
      severity,
      title,
      message,
    });

    if (notification) {
      notifications.push(notification);
    }
  }

  return notifications;
};

export const notifyBusinessUsers = async ({
  connection,
  company_id,
  exclude_user_id = null,
  type = "system",
  severity = "medium",
  title,
  message,
}) => {
  return notifyUsersByRoles({
    connection,
    company_id,
    roles: ["company_admin", "accountant", "sales_user"],
    exclude_user_id,
    type,
    severity,
    title,
    message,
  });
};

export const notifyCompanyAdmins = async ({
  connection,
  company_id,
  exclude_user_id = null,
  type = "system",
  severity = "medium",
  title,
  message,
}) => {
  return notifyUsersByRoles({
    connection,
    company_id,
    roles: ["company_admin"],
    exclude_user_id,
    type,
    severity,
    title,
    message,
  });
};

export const notifyCustomer = async ({
  connection,
  company_id,
  user_id,
  type = "system",
  severity = "medium",
  title,
  message,
}) => {
  return createNotification({
    connection,
    company_id,
    user_id,
    type,
    severity,
    title,
    message,
  });
};

export const notifySuperAdmins = async ({
  connection,
  type = "system",
  severity = "medium",
  title,
  message,
}) => {
  if (!connection) {
    throw new Error("Database connection is required");
  }

  const [superAdmins] = await connection.query(
    `
    SELECT id
    FROM tbl_users
    WHERE role = 'superadmin'
    AND status = 'active'
    `,
  );

  const notifications = [];

  for (const admin of superAdmins) {
    const notification = await createNotification({
      connection,
      company_id: null,
      user_id: admin.id,
      type,
      severity,
      title,
      message,
    });

    if (notification) {
      notifications.push(notification);
    }
  }

  return notifications;
};