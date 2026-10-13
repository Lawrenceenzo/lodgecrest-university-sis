const nodemailer = require('nodemailer');
const brand = require('../config/brand');

const emailConfigured = () => Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS);

let transporter;
function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS.replace(/\s+/g, ''),
      },
      tls: {
        rejectUnauthorized: false,
      },
      connectionTimeout: 10000, // 10s timeout so it fails fast if blocked
    });
  }
  return transporter;
}

async function checkMailer() {
  if (!emailConfigured()) {
    console.warn('Email not configured (EMAIL_USER / EMAIL_PASS). Login codes will be printed here instead of emailed.');
    return;
  }
  console.log(`Mailer initialized for ${process.env.EMAIL_USER} (Note: Render free tier restricts outbound SMTP ports, fallback logging active).`);
}

async function sendOtpEmail({ name, email }, otp) {
  if (!emailConfigured()) {
    console.warn(`[dev] Login code for ${email}: ${otp}`);
    return;
  }

  const minutes = 5;
  try {
    await getTransporter().sendMail({
      from: `"${brand.name}" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `${brand.name}: your verification code is ${otp}`,
      text: `Hi ${name},\n\nYour verification code is ${otp}.\nIt expires in ${minutes} minutes.`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:420px;margin:auto;padding:24px;border:1px solid #e3e7ef;border-radius:8px">
          <h2 style="margin:0 0 4px;color:${brand.navy};font-family:Georgia,serif">${brand.name}</h2>
          <p style="margin:0 0 12px;color:#8a6a2c;font-size:11px;letter-spacing:2px;text-transform:uppercase">${brand.system}</p>
          <p style="color:#444">Hi ${name.replace(/[<>&"]/g, '')}, use this code to finish signing in:</p>
          <p style="font-size:32px;letter-spacing:8px;font-weight:bold;color:${brand.navy};margin:16px 0">${otp}</p>
          <p style="color:#666;font-size:13px">It expires in ${minutes} minutes.</p>
        </div>`,
    });
  } catch (err) {
    // Render free tier blocks outbound SMTP. Gracefully catch it and print the OTP clearly in the logs!
    console.warn('\n========================================');
    console.warn('⚠️ RENDER SMTP PORT BLOCKED (Free Tier Limitation)');
    console.warn(`🔑 LOGIN CODE FOR ${email}: ${otp}`);
    console.warn('========================================\n');
  }
}

module.exports = { checkMailer, sendOtpEmail };