import db from "../config/db.js";

// SUPERADMIN DASHBOARD
export const getSuperAdminStats = async (req, res) => {
  try {
    const [companyRows] = await db.query(`
      SELECT COUNT(*) AS total_companies
      FROM tbl_companies
    `);

    const [activeRows] = await db.query(`
      SELECT COUNT(*) AS active_companies
      FROM tbl_companies
      WHERE status = 'active'
    `);

    const [adminRows] = await db.query(`
      SELECT COUNT(*) AS total_admins
      FROM tbl_users
      WHERE role = 'company_admin'
    `);

    const [revenueRows] = await db.query(`
      SELECT COALESCE(SUM(amount), 0) AS total_revenue
      FROM tbl_subscription_payments
      WHERE payment_status = 'paid'
    `);

    const [recentCompanies] = await db.query(`
      SELECT
        id,
        name,
        email,
        phone,
        gst_number,
        pan_number,
        website,
        address,
        currency,
        status,
        created_at
      FROM tbl_companies
      ORDER BY id DESC
      LIMIT 5
    `);

    return res.json({
      stats: {
        total_companies: Number(companyRows[0].total_companies || 0),
        active_companies: Number(activeRows[0].active_companies || 0),
        total_admins: Number(adminRows[0].total_admins || 0),
        total_revenue: Number(revenueRows[0].total_revenue || 0),
      },
      recentCompanies,
    });
  } catch (error) {
    return res.status(500).json({
      message: "SuperAdmin dashboard error",
      error: error.message,
    });
  }
};

// SUPERADMIN COMPANY DETAILS + DRILLDOWN LISTS
export const getSuperAdminCompanyDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const [companyRows] = await db.query(
      `
      SELECT
  id,
  name,
  email,
  phone,
  gst_number,
  pan_number,
  website,
  address,
  currency,
  status,

  kyc_status,
  kyc_attempts,
  kyc_verified_at,
  kyc_verified_by,
  kyc_rejection_reason,

  created_at
FROM tbl_companies
WHERE id = ?
LIMIT 1
      `,
      [id],
    );

    if (companyRows.length === 0) {
      return res.status(404).json({
        message: "Company not found",
      });
    }

    const [adminRows] = await db.query(
      `
      SELECT
        id,
        name,
        email,
        role,
        status,
        last_login_at,
        created_at
      FROM tbl_users
      WHERE company_id = ?
      AND role = 'company_admin'
      ORDER BY id DESC
      LIMIT 1
      `,
      [id],
    );

    const [branchRows] = await db.query(
      `
      SELECT
        COUNT(*) AS total_branches,
        COALESCE(SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END), 0) AS active_branches,
        COALESCE(SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END), 0) AS inactive_branches
      FROM tbl_company_branches
      WHERE company_id = ?
      `,
      [id],
    );

    const [userRows] = await db.query(
      `
      SELECT
        COUNT(*) AS total_users,
        COALESCE(SUM(CASE WHEN role = 'accountant' THEN 1 ELSE 0 END), 0) AS accountants,
        COALESCE(SUM(CASE WHEN role = 'sales_user' THEN 1 ELSE 0 END), 0) AS sales_users
      FROM tbl_users
      WHERE company_id = ?
      `,
      [id],
    );

    const [invoiceRows] = await db.query(
      `
      SELECT
        COUNT(*) AS total_invoices,
        COALESCE(SUM(total_amount), 0) AS invoice_value,
        COALESCE(SUM(paid_amount), 0) AS paid_amount,
        COALESCE(SUM(balance_due), 0) AS pending_amount
      FROM tbl_invoices
      WHERE company_id = ?
      `,
      [id],
    );

    const [subscriptionRows] = await db.query(
      `
      SELECT
        cs.id,
        cs.status,
        cs.start_date,
        cs.trial_end_date,
        cs.renewal_date,
        cs.auto_renewal,
        sp.plan_name,
        sp.price,
        sp.billing_cycle,
        sp.max_users,
        sp.max_invoices,
        sp.max_branches
      FROM tbl_company_subscriptions cs
      LEFT JOIN tbl_subscription_plans sp
        ON cs.plan_id = sp.id
      WHERE cs.company_id = ?
      ORDER BY cs.id DESC
      LIMIT 1
      `,
      [id],
    );

    const [subscriptionHistory] = await db.query(
  `
  SELECT
    cs.id,
    cs.status,
    cs.start_date,
    cs.trial_end_date,
    cs.renewal_date,
    cs.auto_renewal,
    cs.created_at,
    sp.plan_name,
    sp.price,
    sp.billing_cycle,
    sp.max_users,
    sp.max_invoices,
    sp.max_branches
  FROM tbl_company_subscriptions cs
  LEFT JOIN tbl_subscription_plans sp
    ON cs.plan_id = sp.id
  WHERE cs.company_id = ?
  ORDER BY cs.id DESC
  `,
  [id],
);

    const [subscriptionPaymentRows] = await db.query(
      `
      SELECT
        COUNT(*) AS total_payments,
        COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN amount ELSE 0 END), 0) AS total_revenue
      FROM tbl_subscription_payments
      WHERE company_id = ?
      `,
      [id],
    );

    const [branchList] = await db.query(
      `
      SELECT
        id,
        branch_name,
        branch_code,
        email,
        phone,
        city,
        state,
        status,
        created_at
      FROM tbl_company_branches
      WHERE company_id = ?
      ORDER BY id DESC
      `,
      [id],
    );

    const [userList] = await db.query(
      `
      SELECT
        u.id,
        u.name,
        u.email,
        u.role,
        u.status,
        u.last_login_at,
        u.created_at,
        b.branch_name
      FROM tbl_users u
      LEFT JOIN tbl_company_branches b
        ON u.branch_id = b.id
      WHERE u.company_id = ?
      ORDER BY u.id DESC
      `,
      [id],
    );

    const [invoiceList] = await db.query(
      `
      SELECT
        i.id,
        i.invoice_number,
        i.invoice_date,
        i.due_date,
        i.total_amount,
        i.paid_amount,
        i.balance_due,
        i.status,
        i.created_at,
        c.customer_name,
        b.branch_name
      FROM tbl_invoices i
      LEFT JOIN tbl_customers c
        ON i.customer_id = c.id
      LEFT JOIN tbl_company_branches b
        ON i.branch_id = b.id
      WHERE i.company_id = ?
      ORDER BY i.id DESC
      LIMIT 25
      `,
      [id],
    );

    const [paymentList] = await db.query(
      `
      SELECT
        id,
        subscription_id,
        amount,
        payment_status,
        payment_method,
        transaction_id,
        payment_date,
        created_at
      FROM tbl_subscription_payments
      WHERE company_id = ?
      ORDER BY id DESC
      LIMIT 25
      `,
      [id],
    );

    return res.json({
      company: companyRows[0],
      admin: adminRows[0] || null,
      subscription: subscriptionRows[0] || null,
      subscriptionHistory: subscriptionHistory || [],
      branches: {
        total: Number(branchRows[0].total_branches || 0),
        active: Number(branchRows[0].active_branches || 0),
        inactive: Number(branchRows[0].inactive_branches || 0),
      },
      users: {
        total: Number(userRows[0].total_users || 0),
        accountants: Number(userRows[0].accountants || 0),
        sales_users: Number(userRows[0].sales_users || 0),
      },
      invoices: {
        total: Number(invoiceRows[0].total_invoices || 0),
        invoice_value: Number(invoiceRows[0].invoice_value || 0),
        paid_amount: Number(invoiceRows[0].paid_amount || 0),
        pending_amount: Number(invoiceRows[0].pending_amount || 0),
      },
      revenue: {
        total_payments: Number(subscriptionPaymentRows[0].total_payments || 0),
        total_revenue: Number(subscriptionPaymentRows[0].total_revenue || 0),
      },
      lists: {
        branches: branchList || [],
        users: userList || [],
        invoices: invoiceList || [],
        payments: paymentList || [],
      },
    });
  } catch (error) {
    console.error("Company details error:", error);

    return res.status(500).json({
      message: "Company details error",
      error: error.message,
    });
  }
};
