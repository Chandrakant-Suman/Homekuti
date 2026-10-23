const nodemailer = require("nodemailer");

/*
 * Email delivery, picked from .env in this order:
 *   1. BREVO_API_KEY → Brevo HTTPS API (works on hosts that block SMTP, e.g. Render free tier)
 *   2. SMTP_HOST     → Nodemailer over SMTP (fine locally / on hosts that allow it)
 *   3. neither       → log the email to the console (local development)
 */

const SEND_TIMEOUT_MS = 15000;

// MAIL_FROM like: "Homekuti <homekuti247@gmail.com>" or just an address
function parseFrom(raw) {
    const fallbackName = process.env.APP_NAME || "Homekuti";
    const value = (raw || "").trim().replace(/^"|"$/g, "");
    const m = value.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/);
    if (m) return { name: m[1].trim() || fallbackName, email: m[2].trim() };
    if (value.includes("@")) return { name: fallbackName, email: value };
    return { name: fallbackName, email: process.env.SMTP_USER || "no-reply@homekuti.local" };
}

const FROM = parseFrom(process.env.MAIL_FROM);

let provider = "console";
let transporter = null;

if (process.env.BREVO_API_KEY) {
    provider = "brevo";
} else if (process.env.SMTP_HOST) {
    provider = "smtp";
    transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === "true", // true for port 465
        auth: process.env.SMTP_USER
            ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
            : undefined,
        // Fail fast instead of hanging the request when the port is blocked
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: SEND_TIMEOUT_MS,
    });
}

console.log(`✓ Mailer: ${provider}${provider !== "console" ? ` (from ${FROM.email})` : ""}`);

async function sendViaBrevo({ to, subject, text, html }) {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
            "api-key": process.env.BREVO_API_KEY,
            "content-type": "application/json",
            accept: "application/json",
        },
        body: JSON.stringify({
            sender: FROM,
            to: [{ email: to }],
            subject,
            textContent: text,
            htmlContent: html || undefined,
        }),
        signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
    if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Brevo API ${res.status}: ${body.slice(0, 300)}`);
    }
}

module.exports.sendMail = async ({ to, subject, text, html }) => {
    try {
        if (provider === "brevo") return await sendViaBrevo({ to, subject, text, html });
        if (provider === "smtp") {
            return await transporter.sendMail({ from: { name: FROM.name, address: FROM.email }, to, subject, text, html });
        }
    } catch (err) {
        // Log enough to diagnose in production logs, then let the caller show a friendly error
        console.error(`[mailer:${provider}] send to ${to} failed: ${err.code || ""} ${err.message}`);
        throw err;
    }

    console.log("──── [mailer] No email provider configured; email not sent ────");
    console.log(`To: ${to}\nSubject: ${subject}\n\n${text}`);
    console.log("────────────────────────────────────────────────────────────────");
};

module.exports.mailProvider = () => provider;
