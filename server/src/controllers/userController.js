import db from "../config/db.js";
import bcrypt from "bcryptjs";
import multer from "multer";
import fs from "fs";
import path from "path";
import { createAuditLog } from "../utils/auditLogger.js";
import { notifyCompanyAdmins } from "../utils/notificationLoggers.js";

const normalizeEmail = (email) => {
  return email ? email.trim().toLowerCase() : "";
};

const getRoleModuleName = (role) => {
  if (role === "company_admin") return "Company Admin";
  if (role === "accountant") return "Accountant";
  if (role === "sales_user") return "Sales User";
  return "User";
};

const getRoleLabel = (role) => {
  if (role === "company_admin") return "Company Admin";
  if (role === "accountant") return "Accountant";
  if (role === "sales_user") return "Sales User";
  return "User";
};

const validateBranch = async (company_id, branch_id) => {
  if (!branch_id) {
    return { error: "Branch is required for this user" };
  }

  const [branchRows] = await db.query(
    `
    SELECT id, branch_name
    FROM tbl_company_branches
    WHERE id = ? AND company_id = ? AND status = 'active'
    LIMIT 1
    `,
    [branch_id, company_id],
  );

  if (branchRows.length === 0) {
    return {
      error: "Branch must be active and belong to the same company",
    };
  }

  return {
    branch: branchRows[0],
  };
};

const getMainBranchId = async (company_id) => {
  const [branchRows] = await db.query(
    `
    SELECT id
    FROM tbl_company_branches
    WHERE company_id = ?
    AND is_main = 1
    AND status = 'active'
    LIMIT 1
    `,
    [company_id],
  );

  return branchRows[0]?.id || null;
};

// CREATE COMPANY ADMIN
export const createAdmin = async (req, res) => {
  try {
    const { name, email, password, company_id } = req.body;
    const userEmail = normalizeEmail(email);

    if (!name?.trim() || !userEmail || !password || !company_id) {
      return res.status(400).json({
        message: "Name, email, password and company are required",
      });
    }

    const [company] = await db.query(
      "SELECT id FROM tbl_companies WHERE id = ? LIMIT 1",
      [company_id],
    );

    if (company.length === 0) {
      return res.status(404).json({ message: "Company not found" });
    }

    const mainBranchId = await getMainBranchId(company_id);

    if (!mainBranchId) {
      return res.status(400).json({
        message: "Main HQ branch not found for this company",
      });
    }

    const [existing] = await db.query(
      "SELECT id FROM tbl_users WHERE email = ? LIMIT 1",
      [userEmail],
    );

    if (existing.length > 0) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [adminResult] = await db.query(
      `
      INSERT INTO tbl_users
      (name, email, password, role, company_id, branch_id, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        name.trim(),
        userEmail,
        hashedPassword,
        "company_admin",
        company_id,
        mainBranchId,
        "active",
      ],
    );

    await createAuditLog({
      company_id,
      user_id: req.user.id,
      action: "CREATE",
      module_name: "Company Admin",
      record_id: adminResult.insertId,
      description: `Company Admin ${name.trim()} created`,
      ip_address: req.ip,
    });

    return res.status(201).json({
      message: "Company Admin created successfully",
    });
  } catch (error) {
    return res.status(500).json({
      message: "Create admin error",
      error: error.message,
    });
  }
};

// GET ALL COMPANY ADMINS
export const getAdmins = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const search = req.query.search?.trim() || "";
    const status = req.query.status || "all";

    let whereClause = "WHERE u.role = ?";
    const params = ["company_admin"];

    if (search) {
      whereClause += `
        AND (
          u.name LIKE ?
          OR u.email LIKE ?
          OR c.name LIKE ?
          OR u.status LIKE ?
          OR u.role LIKE ?
        )
      `;

      const keyword = `%${search}%`;

      params.push(keyword, keyword, keyword, keyword, keyword);
    }

    if (status !== "all") {
      whereClause += " AND u.status = ?";
      params.push(status);
    }

    // Total Count
    const [countRows] = await db.query(
      `
      SELECT COUNT(*) AS total
      FROM tbl_users u
      LEFT JOIN tbl_companies c ON u.company_id = c.id
      ${whereClause}
      `,
      params,
    );

    const total = countRows[0].total;
    const totalPages = Math.ceil(total / limit);

    // Paged Data
    const [admins] = await db.query(
      `
      SELECT
        u.id,
        u.name,
        u.email,
        u.role,
        u.status,
        u.company_id,
        u.branch_id,
        c.name AS company_name,
        b.branch_name,
        b.branch_code,
        u.created_at
      FROM tbl_users u
      LEFT JOIN tbl_companies c ON u.company_id = c.id
      LEFT JOIN tbl_company_branches b ON u.branch_id = b.id
      ${whereClause}
      ORDER BY u.id DESC
      LIMIT ? OFFSET ?
      `,
      [...params, limit, offset],
    );

    return res.json({
      admins,
      total,
      page,
      limit,
      totalPages,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Get admins error",
      error: error.message,
    });
  }
};

// CREATE ACCOUNTANT
export const createAccountant = async (req, res) => {
  try {
    const { name, email, password, branch_id } = req.body;
    const company_id = req.user.company_id;
    const userEmail = normalizeEmail(email);

    if (!name?.trim() || !userEmail || !password) {
      return res.status(400).json({
        message: "Name, email and password are required",
      });
    }

    if (!company_id) {
      return res.status(400).json({
        message: "Company ID missing from token",
      });
    }

    const branchValidation = await validateBranch(company_id, branch_id);

    if (branchValidation?.error) {
      return res.status(400).json({
        message: branchValidation.error,
      });
    }

    const [existing] = await db.query(
      "SELECT id FROM tbl_users WHERE email = ? LIMIT 1",
      [userEmail],
    );

    if (existing.length > 0) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [accountantResult] = await db.query(
      `
      INSERT INTO tbl_users
(name, email, password, role, company_id, branch_id, status)
VALUES (?, ?, ?, ?, ?, ?, ?)

      `,
      [
        name.trim(),
        userEmail,
        hashedPassword,
        "accountant",
        company_id,
        branch_id,
        "active",
      ],
    );

    await createAuditLog({
      company_id,
      user_id: req.user.id,
      action: "CREATE",
      module_name: "Accountant",
      record_id: accountantResult.insertId,
      description: `Accountant ${name.trim()} created for ${
        branchValidation.branch.branch_name
      }`,
      ip_address: req.ip,
    });

    await notifyCompanyAdmins({
      company_id,
      exclude_user_id: req.user.id,
      type: "user",
      severity: "medium",
      title: "New Accountant Created",
      message: `${name.trim()} added as Accountant.`,
    });

    return res.status(201).json({
      message: "Accountant created successfully",
    });
  } catch (error) {
    return res.status(500).json({
      message: "Create accountant error",
      error: error.message,
    });
  }
};

// GET COMPANY ACCOUNTANTS
export const getAccountants = async (req, res) => {
  try {
    const company_id = req.user.company_id;

    const [accountants] = await db.query(
      `
      SELECT 
        u.id,
        u.name,
        u.email,
        u.role,
        u.company_id,
        u.branch_id,
        u.status,
        b.branch_name,
        b.branch_code,
        u.created_at
      FROM tbl_users u
      LEFT JOIN tbl_company_branches b ON u.branch_id = b.id
      WHERE u.role = ?
      AND u.company_id = ?
      ORDER BY u.id DESC
      `,
      ["accountant", company_id],
    );

    return res.json(accountants);
  } catch (error) {
    return res.status(500).json({
      message: "Get accountants error",
      error: error.message,
    });
  }
};

// CREATE SALES USER
export const createSalesUser = async (req, res) => {
  try {
    const { name, email, password, branch_id } = req.body;
    const company_id = req.user.company_id;
    const userEmail = normalizeEmail(email);

    if (!name?.trim() || !userEmail || !password) {
      return res.status(400).json({
        message: "Name, email and password are required",
      });
    }

    if (!company_id) {
      return res.status(400).json({
        message: "Company ID missing from token",
      });
    }

    const branchValidation = await validateBranch(company_id, branch_id);

    if (branchValidation?.error) {
      return res.status(400).json({
        message: branchValidation.error,
      });
    }

    const [existing] = await db.query(
      "SELECT id FROM tbl_users WHERE email = ? LIMIT 1",
      [userEmail],
    );

    if (existing.length > 0) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [salesUserResult] = await db.query(
      `
      INSERT INTO tbl_users
(name, email, password, role, company_id, branch_id, status)
VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        name.trim(),
        userEmail,
        hashedPassword,
        "sales_user",
        company_id,
        branch_id,
        "active",
      ],
    );

    await createAuditLog({
      company_id,
      user_id: req.user.id,
      action: "CREATE",
      module_name: "Sales User",
      record_id: salesUserResult.insertId,
      description: `Sales User ${name.trim()} created for ${
        branchValidation.branch.branch_name
      }`,
      ip_address: req.ip,
    });

    await notifyCompanyAdmins({
      company_id,
      type: "user",
      exclude_user_id: req.user.id,
      severity: "medium",
      title: "New Sales User Created",
      message: `${name.trim()} added as Sales User.`,
    });

    return res.status(201).json({
      message: "Sales user created successfully",
    });
  } catch (error) {
    return res.status(500).json({
      message: "Create sales user error",
      error: error.message,
    });
  }
};

// GET COMPANY SALES USERS
export const getSalesUsers = async (req, res) => {
  try {
    const company_id = req.user.company_id;

    const [salesUsers] = await db.query(
      `
      SELECT 
        u.id,
        u.name,
        u.email,
        u.role,
        u.company_id,
        u.branch_id,
        u.status,
        b.branch_name,
        b.branch_code,
        u.created_at
      FROM tbl_users u
      LEFT JOIN tbl_company_branches b ON u.branch_id = b.id
      WHERE u.role = ?
      AND u.company_id = ?
      ORDER BY u.id DESC
      `,
      ["sales_user", company_id],
    );

    return res.json(salesUsers);
  } catch (error) {
    return res.status(500).json({
      message: "Get sales users error",
      error: error.message,
    });
  }
};

// UPDATE TEAM USER
export const updateTeamUser = async (req, res) => {
  try {
    const company_id = req.user.company_id;
    const { id } = req.params;
    const { name, email, password, branch_id } = req.body;
    const userEmail = normalizeEmail(email);

    if (!company_id) {
      return res.status(400).json({ message: "Company ID missing from token" });
    }

    if (!name?.trim() || !userEmail) {
      return res.status(400).json({ message: "Name and email are required" });
    }

    const branchValidation = await validateBranch(company_id, branch_id);

    if (branchValidation?.error) {
      return res.status(400).json({
        message: branchValidation.error,
      });
    }

    const [userRows] = await db.query(
      `
      SELECT id, role
      FROM tbl_users
      WHERE id = ?
      AND company_id = ?
      AND role IN ('accountant', 'sales_user')
      LIMIT 1
      `,
      [id, company_id],
    );

    if (userRows.length === 0) {
      return res.status(404).json({ message: "Team user not found" });
    }

    const teamRole = userRows[0].role;

    const [emailRows] = await db.query(
      `
      SELECT id
      FROM tbl_users
      WHERE email = ?
      AND id != ?
      LIMIT 1
      `,
      [userEmail, id],
    );

    if (emailRows.length > 0) {
      return res.status(400).json({ message: "Email already exists" });
    }

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);

      await db.query(
        `
        UPDATE tbl_users
        SET name = ?, email = ?, password = ?, branch_id = ?
        WHERE id = ?
        AND company_id = ?
        AND role IN ('accountant', 'sales_user')
        `,
        [name.trim(), userEmail, hashedPassword, branch_id, id, company_id],
      );
    } else {
      await db.query(
        `
        UPDATE tbl_users
        SET name = ?, email = ?, branch_id = ?
        WHERE id = ?
        AND company_id = ?
        AND role IN ('accountant', 'sales_user')
        `,
        [name.trim(), userEmail, branch_id, id, company_id],
      );
    }

    await createAuditLog({
      company_id,
      user_id: req.user.id,
      action: "UPDATE",
      module_name: getRoleModuleName(teamRole),
      record_id: id,
      description: `${getRoleLabel(teamRole)} ${name.trim()} updated for ${
        branchValidation.branch.branch_name
      }`,
      ip_address: req.ip,
    });

    return res.json({ message: "Team user updated successfully" });
  } catch (error) {
    return res.status(500).json({
      message: "Update team user error",
      error: error.message,
    });
  }
};

// ACTIVATE / DEACTIVATE TEAM USER
export const updateTeamUserStatus = async (req, res) => {
  try {
    const company_id = req.user.company_id;
    const { id } = req.params;
    const { status } = req.body;

    if (!company_id) {
      return res.status(400).json({ message: "Company ID missing from token" });
    }

    if (!["active", "inactive"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const [userRows] = await db.query(
      `
      SELECT id, name, role
      FROM tbl_users
      WHERE id = ?
      AND company_id = ?
      AND role IN ('accountant', 'sales_user')
      LIMIT 1
      `,
      [id, company_id],
    );

    if (userRows.length === 0) {
      return res.status(404).json({ message: "Team user not found" });
    }

    const [result] = await db.query(
      `
      UPDATE tbl_users
      SET status = ?
      WHERE id = ?
      AND company_id = ?
      AND role IN ('accountant', 'sales_user')
      `,
      [status, id, company_id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Team user not found" });
    }

    await createAuditLog({
      company_id,
      user_id: req.user.id,
      action: "UPDATE",
      module_name: getRoleModuleName(userRows[0].role),
      record_id: id,
      description: `${getRoleLabel(userRows[0].role)} ${
        userRows[0].name
      } status changed to ${status}`,
      ip_address: req.ip,
    });

    if (status === "inactive") {
      await notifyCompanyAdmins({
        company_id,
        type: "user",
        exclude_user_id: req.user.id,
        severity: "medium",
        title: "User Deactivated",
        message: `${userRows[0].name} deactivated.`,
      });
    }

    return res.json({ message: `User ${status} successfully` });
  } catch (error) {
    return res.status(500).json({
      message: "Update user status error",
      error: error.message,
    });
  }
};

// UPDATE COMPANY ADMIN
export const updateAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, password, company_id } = req.body;
    const userEmail = normalizeEmail(email);

    if (!name?.trim() || !userEmail || !company_id) {
      return res.status(400).json({
        message: "Name, email and company are required",
      });
    }

    const [adminRows] = await db.query(
      `
      SELECT id, name, email, company_id
      FROM tbl_users
      WHERE id = ?
      AND role = 'company_admin'
      LIMIT 1
      `,
      [id],
    );

    if (adminRows.length === 0) {
      return res.status(404).json({
        message: "Company Admin not found",
      });
    }

    const [companyRows] = await db.query(
      `
      SELECT id, name
      FROM tbl_companies
      WHERE id = ?
      LIMIT 1
      `,
      [company_id],
    );

    if (companyRows.length === 0) {
      return res.status(404).json({
        message: "Company not found",
      });
    }

    const mainBranchId = await getMainBranchId(company_id);

    if (!mainBranchId) {
      return res.status(400).json({
        message: "Main HQ branch not found for this company",
      });
    }

    const [emailRows] = await db.query(
      `
      SELECT id
      FROM tbl_users
      WHERE email = ?
      AND id != ?
      LIMIT 1
      `,
      [userEmail, id],
    );

    if (emailRows.length > 0) {
      return res.status(400).json({
        message: "Email already exists",
      });
    }

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);

      await db.query(
        `
        UPDATE tbl_users
        SET
          name = ?,
          email = ?,
          password = ?,
          company_id = ?,
          branch_id = ?
        WHERE id = ?
        AND role = 'company_admin'
        `,
        [name.trim(), userEmail, hashedPassword, company_id, mainBranchId, id],
      );
    } else {
      await db.query(
        `
        UPDATE tbl_users
        SET
          name = ?,
          email = ?,
          company_id = ?,
          branch_id = ?
        WHERE id = ?
        AND role = 'company_admin'
        `,
        [name.trim(), userEmail, company_id, mainBranchId, id],
      );
    }

    await createAuditLog({
      company_id,
      user_id: req.user.id,
      action: "UPDATE",
      module_name: "Company Admin",
      record_id: id,
      description: `Company Admin ${name.trim()} updated for ${companyRows[0].name}`,
      ip_address: req.ip,
    });

    return res.json({
      message: "Company Admin updated successfully",
    });
  } catch (error) {
    return res.status(500).json({
      message: "Update admin error",
      error: error.message,
    });
  }
};

// ACTIVATE / DEACTIVATE COMPANY ADMIN
export const updateAdminStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["active", "inactive"].includes(status)) {
      return res.status(400).json({
        message: "Invalid status",
      });
    }

    const [adminRows] = await db.query(
      `
      SELECT id, name, company_id, status
      FROM tbl_users
      WHERE id = ?
      AND role = 'company_admin'
      LIMIT 1
      `,
      [id],
    );

    if (adminRows.length === 0) {
      return res.status(404).json({
        message: "Company Admin not found",
      });
    }

    const admin = adminRows[0];

    await db.query(
      `
      UPDATE tbl_users
      SET status = ?
      WHERE id = ?
      AND role = 'company_admin'
      `,
      [status, id],
    );

    await createAuditLog({
      company_id: admin.company_id,
      user_id: req.user.id,
      action: "UPDATE",
      module_name: "Company Admin",
      record_id: id,
      description: `Company Admin ${admin.name} status changed to ${status}`,
      ip_address: req.ip,
    });

    return res.json({
      message: `Company Admin ${status} successfully`,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Update admin status error",
      error: error.message,
    });
  }
};

const profileUploadDir = path.join(process.cwd(), "uploads", "profiles");

if (!fs.existsSync(profileUploadDir)) {
  fs.mkdirSync(profileUploadDir, { recursive: true });
}

const allowedImageTypes = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];

const profileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, profileUploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const randomName = `${Math.floor(100000 + Math.random() * 900000)}${ext}`;
    cb(null, randomName);
  },
});

const profileUpload = multer({
  storage: profileStorage,
  limits: {
    fileSize: 2 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (!allowedImageTypes.includes(file.mimetype)) {
      return cb(new Error("Only JPG, PNG and WEBP images are allowed"));
    }

    cb(null, true);
  },
}).single("profile_image");

export const uploadProfileImage = async (req, res) => {
  profileUpload(req, res, async (uploadError) => {
    try {
      if (uploadError) {
        return res.status(400).json({
          message: uploadError.message || "Profile image upload failed",
        });
      }

      if (!req.file) {
        return res.status(400).json({
          message: "Profile image is required",
        });
      }

      const user_id = req.user.id;

      const [userRows] = await db.query(
        `
        SELECT id, name, email, role, company_id, branch_id, profile_image
        FROM tbl_users
        WHERE id = ?
        LIMIT 1
        `,
        [user_id],
      );

      if (userRows.length === 0) {
        return res.status(404).json({
          message: "User not found",
        });
      }

      const oldImage = userRows[0].profile_image;
      const newImage = req.file.filename;

      await db.query(
        `
        UPDATE tbl_users
        SET profile_image = ?
        WHERE id = ?
        `,
        [newImage, user_id],
      );

      if (oldImage) {
        const oldImagePath = path.join(profileUploadDir, oldImage);

        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }

      const [updatedRows] = await db.query(
        `
        SELECT 
          id,
          name,
          email,
          role,
          company_id,
          branch_id,
          status,
          profile_image
        FROM tbl_users
        WHERE id = ?
        LIMIT 1
        `,
        [user_id],
      );

      await createAuditLog({
        company_id: req.user.company_id || userRows[0].company_id || null,
        user_id,
        action: "UPDATE",
        module_name: "Profile",
        record_id: user_id,
        description: `${userRows[0].name} updated profile image`,
        ip_address: req.ip,
      });

      return res.json({
        message: "Profile image updated successfully",
        user: updatedRows[0],
      });
    } catch (error) {
      return res.status(500).json({
        message: "Upload profile image error",
        error: error.message,
      });
    }
  });
};

// GET INACTIVE USERS - SuperAdmin
export const getInactiveUsers = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const search = req.query.search?.trim() || "";
    const bucket = req.query.bucket || "all";

    let whereClause = `
      WHERE u.role IN ('company_admin', 'accountant', 'sales_user', 'customer')
    `;

    const params = [];

    if (search) {
      whereClause += `
        AND (
          u.name LIKE ?
          OR u.email LIKE ?
          OR u.role LIKE ?
          OR c.name LIKE ?
        )
      `;

      const keyword = `%${search}%`;
      params.push(keyword, keyword, keyword, keyword);
    }

    if (bucket === "never") {
      whereClause += " AND u.last_login_at IS NULL";
    }

    if (bucket === "warning") {
      whereClause += `
        AND u.last_login_at IS NOT NULL
        AND u.last_login_at < DATE_SUB(NOW(), INTERVAL 30 DAY)
        AND u.last_login_at >= DATE_SUB(NOW(), INTERVAL 180 DAY)
      `;
    }

    if (bucket === "inactive") {
      whereClause += `
        AND (
          u.last_login_at IS NULL
          OR u.last_login_at < DATE_SUB(NOW(), INTERVAL 180 DAY)
        )
      `;
    }

    const [countRows] = await db.query(
      `
      SELECT COUNT(*) AS total
      FROM tbl_users u
      LEFT JOIN tbl_companies c ON u.company_id = c.id
      ${whereClause}
      `,
      params,
    );

    const total = countRows[0].total;
    const totalPages = Math.ceil(total / limit);

    const [users] = await db.query(
      `
      SELECT
        u.id,
        u.name,
        u.email,
        u.role,
        u.status,
        u.company_id,
        c.name AS company_name,
        u.last_login_at,
        u.created_at,
        CASE
          WHEN u.last_login_at IS NULL THEN 'never_logged_in'
          WHEN u.last_login_at < DATE_SUB(NOW(), INTERVAL 180 DAY) THEN 'inactive'
          WHEN u.last_login_at < DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 'warning'
          ELSE 'active'
        END AS inactivity_status,
        CASE
          WHEN u.last_login_at IS NULL THEN NULL
          ELSE DATEDIFF(NOW(), u.last_login_at)
        END AS inactive_days
      FROM tbl_users u
      LEFT JOIN tbl_companies c ON u.company_id = c.id
      ${whereClause}
      ORDER BY
        CASE
          WHEN u.last_login_at IS NULL THEN 9999
          ELSE DATEDIFF(NOW(), u.last_login_at)
        END DESC
      LIMIT ? OFFSET ?
      `,
      [...params, limit, offset],
    );

    return res.json({
      users,
      total,
      page,
      limit,
      totalPages,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Get inactive users error",
      error: error.message,
    });
  }
};
