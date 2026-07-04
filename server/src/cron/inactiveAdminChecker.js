import cron from "node-cron";
import db from "../config/db.js";
import transporter from "../utils/emailService.js";
import { createAuditLog } from "../utils/auditLogger.js";

const sendInactiveWarningEmail = async (admin) => {
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: admin.email,
    subject: "Account Inactivity Warning - Smart Invoice",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>Account Inactivity Warning</h2>
        <p>Hello ${admin.name},</p>
        <p>Your company admin account has been inactive for the last 6 months.</p>
        <p><strong>Your account may be permanently deactivated soon.</strong></p>
        <p>Please login to your Smart Invoice account to keep it active.</p>
        <br/>
        <p>Regards,<br/>Smart Invoice Team</p>
      </div>
    `,
  });
};

export const checkInactiveAdmins = async () => {
  try {
    const [warningAdmins] = await db.query(
      `
      SELECT 
        u.id,
        u.name,
        u.email,
        u.company_id,
        c.name AS company_name
      FROM tbl_users u
      LEFT JOIN tbl_companies c ON u.company_id = c.id
      WHERE u.role = 'company_admin'
      AND u.status = 'active'
      AND u.warning_sent_at IS NULL
      AND (
        u.last_login_at IS NULL
        OR u.last_login_at <= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      )
      `,
    );

    for (const admin of warningAdmins) {
      try {
        await sendInactiveWarningEmail(admin);

        await db.query(
          `
          UPDATE tbl_users
          SET warning_sent_at = NOW()
          WHERE id = ?
          `,
          [admin.id],
        );

        await createAuditLog({
          company_id: admin.company_id,
          user_id: admin.id,
          role: "company_admin",
          action: "SECURITY_EVENT",
          module_name: "Company Admin",
          record_id: admin.id,
          description: `Inactive warning email sent to ${admin.name}`,
          ip_address: "SYSTEM",
          user_agent: "CRON_JOB",
        });
      } catch (emailError) {
        console.log("WARNING EMAIL ERROR:", emailError.message);
      }
    }

    const [deactivateAdmins] = await db.query(
      `
      SELECT 
        id,
        name,
        email,
        company_id
      FROM tbl_users
      WHERE role = 'company_admin'
      AND status = 'active'
      AND warning_sent_at IS NOT NULL
      AND warning_sent_at <= DATE_SUB(NOW(), INTERVAL 30 DAY)
      AND (
        last_login_at IS NULL
        OR last_login_at <= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      )
      `,
    );

    for (const admin of deactivateAdmins) {
      await db.query(
        `
        UPDATE tbl_users
        SET status = 'inactive',
            deactivated_at = NOW()
        WHERE id = ?
        `,
        [admin.id],
      );

      await createAuditLog({
        company_id: admin.company_id,
        user_id: admin.id,
        role: "company_admin",
        action: "SECURITY_EVENT",
        module_name: "Company Admin",
        record_id: admin.id,
        description: `Company Admin ${admin.name} auto deactivated due to inactivity`,
        ip_address: "SYSTEM",
        user_agent: "CRON_JOB",
      });
    }

    console.log(
      `Inactive admin check completed. Warning: ${warningAdmins.length}, Deactivated: ${deactivateAdmins.length}`,
    );
  } catch (error) {
    console.log("INACTIVE ADMIN CHECK ERROR:", error.message);
  }
};

export const startInactiveAdminCron = () => {
  cron.schedule("0 1 * * *", async () => {
    await checkInactiveAdmins();
  });

  // console.log("Inactive admin cron started");
};
