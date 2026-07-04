import db from "../config/db.js";

const buildNotificationScope = (req, params) => {
  let whereClause = "WHERE 1=1";

  if (req.user.role === "superadmin") {
    whereClause += " AND (n.user_id = ? OR n.user_id IS NULL)";
    params.push(req.user.id);
    return whereClause;
  }

  if (req.user.company_id) {
    whereClause += " AND n.company_id = ?";
    params.push(req.user.company_id);
  }

  whereClause += " AND (n.user_id = ? OR n.user_id IS NULL)";
  params.push(req.user.id);

  return whereClause;
};

export const getNotifications = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const type = req.query.type || "all";
    const status = req.query.status || "all";

    const params = [];
    let whereClause = buildNotificationScope(req, params);

    if (type !== "all") {
      whereClause += " AND n.type = ?";
      params.push(type);
    }

    if (status === "unread") {
      whereClause += " AND n.is_read = 0";
    }

    if (status === "read") {
      whereClause += " AND n.is_read = 1";
    }

    const [countRows] = await db.query(
      `
      SELECT COUNT(*) AS total
      FROM tbl_notifications n
      ${whereClause}
      `,
      params,
    );

    const total = countRows[0]?.total || 0;
    const totalPages = Math.ceil(total / limit);

    const [notifications] = await db.query(
      `
      SELECT
        n.*,
        c.name AS company_name,
        u.name AS user_name,
        u.email AS user_email
      FROM tbl_notifications n
      LEFT JOIN tbl_companies c ON n.company_id = c.id
      LEFT JOIN tbl_users u ON n.user_id = u.id
      ${whereClause}
      ORDER BY n.id DESC
      LIMIT ? OFFSET ?
      `,
      [...params, limit, offset],
    );

    return res.json({
      notifications,
      total,
      page,
      limit,
      totalPages,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Get notifications error",
      error: error.message,
    });
  }
};

export const getUnreadNotificationCount = async (req, res) => {
  try {
    const params = [];
    let whereClause = buildNotificationScope(req, params);

    whereClause += " AND n.is_read = 0";

    const [rows] = await db.query(
      `
      SELECT COUNT(*) AS unreadCount
      FROM tbl_notifications n
      ${whereClause}
      `,
      params,
    );

    return res.json({
      unreadCount: rows[0]?.unreadCount || 0,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Get unread notification count error",
      error: error.message,
    });
  }
};

export const markNotificationRead = async (req, res) => {
  try {
    const { id } = req.params;

    const params = [id];
    let whereClause = "WHERE id = ?";

    if (req.user.role !== "superadmin") {
      whereClause += " AND company_id = ?";
      params.push(req.user.company_id);
    }

    if (req.user.role !== "superadmin") {
      whereClause += " AND (user_id = ? OR user_id IS NULL)";
      params.push(req.user.id);
    }

    await db.query(
      `
      UPDATE tbl_notifications
      SET is_read = 1
      ${whereClause}
      `,
      params,
    );

    return res.json({ message: "Notification marked as read" });
  } catch (error) {
    return res.status(500).json({
      message: "Mark notification read error",
      error: error.message,
    });
  }
};

export const markAllNotificationsRead = async (req, res) => {
  try {
    const params = [];
    let whereClause = "WHERE is_read = 0";

    if (req.user.role !== "superadmin") {
      whereClause += " AND company_id = ?";
      params.push(req.user.company_id);
    }

    if (req.user.role !== "superadmin") {
      whereClause += " AND (user_id = ? OR user_id IS NULL)";
      params.push(req.user.id);
    }

    await db.query(
      `
      UPDATE tbl_notifications
      SET is_read = 1
      ${whereClause}
      `,
      params,
    );

    return res.json({ message: "All notifications marked as read" });
  } catch (error) {
    return res.status(500).json({
      message: "Mark all notifications read error",
      error: error.message,
    });
  }
};