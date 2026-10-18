const nodemailer = require("nodemailer");

// SMTP settings come from .env. Without SMTP_HOST, emails are logged to the
// console instead so the flow still works in local development.
const isConfigured = Boolean(process.env.SMTP_HOST);

const transporter = isConfigured
    ? nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === "true", // true for port 465
        auth: process.env.SMTP_USER
            ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
            : undefined,
    })
    : null;

const FROM = process.env.MAIL_FROM || `"${process.env.APP_NAME || "Homekuti"}" <no-reply@homekuti.local>`;

module.exports.sendMail = async ({ to, subject, text, html }) => {
    if (!transporter) {
        console.log("──── [mailer] SMTP not configured; email not sent ────");
        console.log(`To: ${to}\nSubject: ${subject}\n\n${text}`);
        console.log("──────────────────────────────────────────────────────");
        return;
    }
    await transporter.sendMail({ from: FROM, to, subject, text, html });
};
