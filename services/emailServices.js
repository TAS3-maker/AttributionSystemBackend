import nodemailer from "nodemailer";
import ENV from "../utils/env.js";

let transporter;

function getTransporter() {
  if (!ENV.SMTP_USER || !ENV.SMTP_PASS) {
    throw new Error("SMTP_USER and SMTP_PASS must be configured");
  }

  if (!transporter) {
    const port = Number(ENV.SMTP_PORT) || 465;

    transporter = nodemailer.createTransport({
      host: "smtp.hostinger.com",
      port,
      secure: port === 465, // true for port 465 (SSL), false for port 587 (TLS)
      auth: {
        user: ENV.SMTP_USER,
        pass: ENV.SMTP_PASS,
      },
    });
  }

  return transporter;
}

export async function sendEmail({ to, subject, html, text }) {
  try {
    return await getTransporter().sendMail({
      from: ENV.EMAIL_FROM || ENV.SMTP_USER,
      to,
      subject,
      text, // Good practice to include plain-text fallback alongside HTML
      html,
    });
  } catch (error) {
    console.error(
      "Email delivery failed:",
      error?.name ?? "error",
      error?.message ?? ""
    );
    throw new Error("Unable to send email");
  }
}
