import cron from "node-cron";
import db from "../config/db.js";
import { emitNotificationUpdate } from "../utils/socketEvents.js";

const createNotification = async ({
  io,
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
    io,
    company_id,
    user_id,
  });
};

const processOverdueInvoices = async (io) => {
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
    WHERE i.status NOT IN ('paid', 'cancelled')
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
        AND status = 'active'
      `,
      [invoice.company_id],
    );

    for (const admin of admins) {
      await createNotification({
        io,
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
};

const processExpiringSubscriptions = async (io) => {
  const [expiringSubscriptions] = await db.query(`
    SELECT
      cs.company_id,
      DATE_FORMAT(cs.renewal_date, '%Y-%m-%d') AS renewal_date,
      c.name AS company_name
    FROM tbl_company_subscriptions cs
    JOIN tbl_companies c
      ON cs.company_id = c.id
    WHERE cs.status = 'active'
      AND cs.renewal_date IS NOT NULL
      AND DATEDIFF(cs.renewal_date, CURDATE()) BETWEEN 0 AND 7
  `);

  for (const subscription of expiringSubscriptions) {
    const renewalDate = subscription.renewal_date;

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
        AND status = 'active'
      `,
      [subscription.company_id],
    );

    for (const admin of admins) {
      await createNotification({
        io,
        company_id: subscription.company_id,
        user_id: admin.id,
        type: "subscription",
        severity: "high",
        title: "Subscription Expiry",
        message: `Your subscription will expire on ${renewalDate}. Please renew soon.`,
      });
    }
  }
};

const processExpiredTrials = async (io) => {
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
        AND status = 'trial'
      `,
      [trial.id],
    );

    const [admins] = await db.query(
      `
      SELECT id
      FROM tbl_users
      WHERE company_id = ?
        AND role = 'company_admin'
        AND status = 'active'
      `,
      [trial.company_id],
    );

    for (const admin of admins) {
      const [existing] = await db.query(
        `
        SELECT id
        FROM tbl_notifications
        WHERE company_id = ?
          AND user_id = ?
          AND title = 'Trial Plan Expired'
        LIMIT 1
        `,
        [trial.company_id, admin.id],
      );

      if (existing.length > 0) continue;

      await createNotification({
        io,
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
};

const runNotificationCron = async (io) => {
  try {
    console.log("Running notification cron...");

    await processOverdueInvoices(io);
    await processExpiringSubscriptions(io);
    await processExpiredTrials(io);

    console.log("Notification cron completed");
  } catch (error) {
    console.error("Notification cron error:", error);
  }
};

export const startNotificationCron = (io) => {
  if (!io) {
    console.error(
      "Notification cron could not start because Socket.IO is missing.",
    );
    return;
  }

  cron.schedule(
    "0 9 * * *",
    async () => {
      await runNotificationCron(io);
    },
    {
      timezone: "Asia/Kolkata",
    },
  );

  console.log(
    "Notification cron scheduled daily at 9:00 AM Asia/Kolkata.",
  );
};
