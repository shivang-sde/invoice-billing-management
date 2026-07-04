import nodemailer from "nodemailer";
import db from "../config/db.js";

const normalizeText = (value) => (value ? String(value).trim() : "");

const isValidEmail = (email) => {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
};

export const validateCompanySmtpConfig = (company = {}) => {
  const smtpHost = normalizeText(company.smtp_host);
  const smtpPort = Number(company.smtp_port);
  const smtpUser = normalizeText(company.smtp_user);
  const smtpPass = normalizeText(company.smtp_pass);

  if (!smtpHost) return "SMTP host is required";
  if (!smtpPort || Number.isNaN(smtpPort)) return "SMTP port is required";
  if (!smtpUser) return "SMTP user is required";
  if (!smtpPass) return "SMTP password is required";

  if (company.from_email && !isValidEmail(company.from_email)) {
    return "From email is invalid";
  }

  if (company.reply_to && !isValidEmail(company.reply_to)) {
    return "Reply-to email is invalid";
  }

  return null;
};

export const createCompanyTransporter = (company = {}) => {
  const validationError = validateCompanySmtpConfig(company);

  if (validationError) {
    throw new Error(validationError);
  }

  return nodemailer.createTransport({
    host: normalizeText(company.smtp_host),
    port: Number(company.smtp_port),
    secure:
      company.smtp_secure === true ||
      company.smtp_secure === 1 ||
      company.smtp_secure === "1",
    auth: {
      user: normalizeText(company.smtp_user),
      pass: normalizeText(company.smtp_pass),
    },
  });
};

export const logEmailAttempt = async ({
  company_id,
  module_type,
  reference_id = null,
  to_email,
  subject,
  status,
  error = null,
}) => {
  await db.query(
    `
    INSERT INTO tbl_email_logs
      (
        company_id,
        module_type,
        reference_id,
        to_email,
        subject,
        status,
        error
      )
    VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      company_id,
      module_type,
      reference_id,
      normalizeText(to_email),
      normalizeText(subject),
      status,
      error,
    ],
  );
};

export const sendCompanyEmail = async ({
  company,
  to,
  subject,
  html,
  text = "",
  attachments = [],
  module_type = "test",
  reference_id = null,
}) => {
  const companyId = company?.id || company?.company_id;

  if (!companyId) {
    throw new Error("Company id is required for email sending");
  }

  if (!isValidEmail(to)) {
    throw new Error("Valid recipient email is required");
  }

  const transporter = createCompanyTransporter(company);

  const fromEmail = normalizeText(company.from_email) || normalizeText(company.smtp_user);
  const fromName = normalizeText(company.from_name) || normalizeText(company.name) || "Company";
  const replyTo = normalizeText(company.reply_to) || fromEmail;

  const mailOptions = {
    from: `"${fromName}" <${fromEmail}>`,
    to: normalizeText(to),
    subject: normalizeText(subject),
    html,
    text,
    replyTo,
    attachments,
  };

  try {
    const info = await transporter.sendMail(mailOptions);

    await logEmailAttempt({
      company_id: companyId,
      module_type,
      reference_id,
      to_email: to,
      subject,
      status: "sent",
      error: null,
    });

    return {
      success: true,
      messageId: info.messageId,
      response: info.response,
    };
  } catch (error) {
    await logEmailAttempt({
      company_id: companyId,
      module_type,
      reference_id,
      to_email: to,
      subject,
      status: "failed",
      error: error.message,
    });

    throw error;
  }
};

export const verifyCompanySmtp = async (company = {}) => {
  const transporter = createCompanyTransporter(company);
  await transporter.verify();

  return true;
};