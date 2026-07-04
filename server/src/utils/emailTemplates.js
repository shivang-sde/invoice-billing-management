const escapeHtml = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

export const passwordResetTemplate = ({
  name = "User",
  resetUrl = "#",
  appName = "Smart Invoice",
  supportEmail = "support@sellsspark.com",
}) => {
  const safeName = escapeHtml(name);
  const safeAppName = escapeHtml(appName);
  const safeSupportEmail = escapeHtml(supportEmail);
  const safeResetUrl = escapeHtml(resetUrl);

  return `
    <div style="margin:0;padding:32px 16px;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
      <div style="max-width:600px;margin:0 auto">
        <div style="text-align:center;margin-bottom:18px">
          <div style="display:inline-block;background:#0f172a;color:#ffffff;padding:12px 18px;border-radius:14px;font-size:20px;font-weight:800">
            ${safeAppName}
          </div>
        </div>

        <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:18px;overflow:hidden">
          <div style="padding:26px 30px;background:#0f172a;color:#ffffff">
            <h1 style="margin:0;font-size:24px;line-height:32px">Password Reset Request</h1>
            <p style="margin:8px 0 0;color:#cbd5e1;font-size:14px">
              Secure password recovery for your account
            </p>
          </div>

          <div style="padding:30px">
            <p style="margin:0 0 14px;font-size:15px;line-height:24px">
              Hello <strong>${safeName}</strong>,
            </p>

            <p style="margin:0 0 16px;font-size:15px;line-height:24px;color:#334155">
              We received a request to reset your ${safeAppName} account password.
            </p>

            <div style="margin:20px 0;padding:14px 16px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:14px;color:#1d4ed8;font-size:14px;font-weight:700">
              This reset link will expire in 15 minutes.
            </div>

            <div style="text-align:center;margin:30px 0">
              <a href="${safeResetUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:14px 24px;border-radius:12px;font-size:15px;font-weight:800">
                Reset Password
              </a>
            </div>

            <p style="margin:0 0 18px;font-size:13px;line-height:22px;color:#64748b">
              If the button does not work, copy and paste this link into your browser:
            </p>

            <p style="word-break:break-all;margin:0 0 22px;font-size:12px;line-height:20px;color:#2563eb">
              ${safeResetUrl}
            </p>

            <div style="padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px">
              <p style="margin:0;font-size:13px;line-height:22px;color:#64748b">
                If you did not request this password reset, you can safely ignore this email.
              </p>
            </div>

            <hr style="border:none;border-top:1px solid #e2e8f0;margin:26px 0" />

            <p style="margin:0 0 16px;font-size:13px;line-height:22px;color:#64748b">
              Need help? Contact us at
              <a href="mailto:${safeSupportEmail}" style="color:#2563eb;font-weight:700;text-decoration:none">
                ${safeSupportEmail}
              </a>
            </p>

            <p style="margin:0;font-size:14px;line-height:22px;color:#334155">
              Regards,<br/>
              <strong>${safeAppName} Team</strong>
            </p>
          </div>
        </div>

        <p style="text-align:center;margin:18px 0 0;font-size:12px;color:#94a3b8">
          © ${new Date().getFullYear()} ${safeAppName}. This is an automated email.
        </p>
      </div>
    </div>
  `;
};