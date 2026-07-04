import cron from "node-cron";
import db from "../config/db.js";
import { emitNotificationUpdate } from "../utils/socketEvents.js";

const createNotification = async ({
  company_id,
  user_id,
  type = "system",
  severity = "medium",
  title,
  message,
}) => {
  if (!title || !message) return;

  await db.query(
    `
    INSERT INTO tbl_notifications
    (
      company_id,
      user_id,
      type,
      severity,
      title,
      message,
      is_read
    )
    VALUES (?, ?, ?, ?, ?, ?, 0)
    `,
    [company_id, user_id, type, severity, title, message],
  );
  emitNotificationUpdate({
    company_id,
    user_id,
  });
};

// DAILY 9:00 AM
cron.schedule("0 9 * * *", async () => {
  try {
    console.log("Running notification cron...");

    // =================================
    // INVOICE OVERDUE NOTIFICATIONS
    // =================================

    const [overdueInvoices] = await db.query(`
      SELECT
        i.id,
        i.company_id,
        i.invoice_number,
        i.balance_due,
        i.due_date,
        c.customer_name
      FROM tbl_invoices i
      LEFT JOIN tbl_customers c
        ON i.customer_id = c.id
      WHERE i.status NOT IN ('paid','cancelled')
      AND i.balance_due > 0
      AND i.due_date IS NOT NULL
      AND i.due_date < CURDATE()
    `);

    for (const invoice of overdueInvoices) {
      const [existing] = await db.query(
        `
        SELECT id
        FROM tbl_notifications
        WHERE company_id = ?
        AND title = 'Invoice Overdue'
        AND message LIKE ?
        LIMIT 1
        `,
        [invoice.company_id, `%${invoice.invoice_number}%`],
      );

      if (existing.length > 0) continue;

      const [admins] = await db.query(
        `
        SELECT id
        FROM tbl_users
        WHERE company_id = ?
        AND role = 'company_admin'
        `,
        [invoice.company_id],
      );

      for (const admin of admins) {
        await createNotification({
          company_id: invoice.company_id,
          user_id: admin.id,
          type: "system",
          severity: "high",
          title: "Invoice Overdue",
          message: `Invoice ${invoice.invoice_number} is overdue. Pending amount ₹${Number(
            invoice.balance_due || 0,
          ).toFixed(2)}${
            invoice.customer_name ? ` from ${invoice.customer_name}` : ""
          }.`,
        });
      }
    }

    // =================================
    // SUBSCRIPTION EXPIRY NOTIFICATIONS
    // =================================

    const [expiringSubscriptions] = await db.query(`
      SELECT
        cs.company_id,
        cs.renewal_date,
        c.name AS company_name
      FROM tbl_company_subscriptions cs
      JOIN tbl_companies c
        ON cs.company_id = c.id
      WHERE cs.status = 'active'
      AND cs.renewal_date IS NOT NULL
      AND DATEDIFF(cs.renewal_date, CURDATE()) BETWEEN 0 AND 7
    `);

    for (const subscription of expiringSubscriptions) {
      const renewalDate = String(subscription.renewal_date).slice(0, 10);

      const [existing] = await db.query(
        `
        SELECT id
        FROM tbl_notifications
        WHERE company_id = ?
        AND title = 'Subscription Expiry'
        AND message LIKE ?
        LIMIT 1
        `,
        [subscription.company_id, `%${renewalDate}%`],
      );

      if (existing.length > 0) continue;

      const [admins] = await db.query(
        `
        SELECT id
        FROM tbl_users
        WHERE company_id = ?
        AND role = 'company_admin'
        `,
        [subscription.company_id],
      );

      for (const admin of admins) {
        await createNotification({
          company_id: subscription.company_id,
          user_id: admin.id,
          type: "subscription",
          severity: "high",
          title: "Subscription Expiry",
          message: `Your subscription will expire on ${renewalDate}. Please renew soon.`,
        });
      }
    }

    console.log("Notification cron completed");
  } catch (error) {
    console.error("Notification cron error:", error);
  }
});

// =================================
// TRIAL EXPIRY CHECK
// =================================

const [expiredTrials] = await db.query(`
  SELECT
    cs.id,
    cs.company_id,
    c.name AS company_name
  FROM tbl_company_subscriptions cs
  JOIN tbl_companies c
    ON cs.company_id = c.id
  WHERE cs.status = 'trial'
  AND cs.trial_end_date IS NOT NULL
  AND cs.trial_end_date < CURDATE()
`);

for (const trial of expiredTrials) {
  await db.query(
    `
    UPDATE tbl_company_subscriptions
    SET status = 'expired'
    WHERE id = ?
    `,
    [trial.id],
  );

  const [admins] = await db.query(
    `
    SELECT id
    FROM tbl_users
    WHERE company_id = ?
    AND role = 'company_admin'
    `,
    [trial.company_id],
  );

  for (const admin of admins) {
    await createNotification({
      company_id: trial.company_id,
      user_id: admin.id,
      type: "subscription",
      severity: "high",
      title: "Trial Plan Expired",
      message:
        "Your 10-day free trial has ended. Please buy a subscription plan or request a one-time 10-day trial extension.",
    });
  }
}

