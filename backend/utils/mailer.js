const nodemailer = require('nodemailer');
const brand = require('../config/brand');

// Sending the login code.
//
// Real e-mail goes out through Gmail SMTP. Some hosts (Render's free tier, for one) block outbound
// SMTP ports, and then every attempt just hangs until it times out. So:
//   - Nothing here touches the network at start-up (checkMailer only reports the configuration).
//   - Sending is capped by a hard deadline, and after a connection-level failure SMTP is skipped for
//     a while, so the second login is not slow as well.
//   - When the e-mail cannot be sent (or e-mail is not configured) the 6-digit code is printed to the
//     server log in a banner, so you can still sign in while testing. The login request succeeds.
//
// OTP_CONSOLE_FALLBACK=false turns the log fallback off. Do that for real use: anyone who can read
// the server log can otherwise sign in as any user. With it off, a failed send makes the login
// request answer 502 and the code is discarded (see routes/auth.js).

const SEND_DEADLINE_MS = Number(process.env.SMTP_SEND_TIMEOUT_MS) || 6000; // longest a login waits for the mail server
const SKIP_SMTP_FOR_MS = 10 * 60 * 1000; // after the server proved unreachable, don't try again for this long
const OTP_MINUTES = 5;

const emailConfigured = () => Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS);
const consoleFallback = () => String(process.env.OTP_CONSOLE_FALLBACK ?? 'true').toLowerCase() !== 'false';

let transporter;
function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false, // STARTTLS on 587
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS.replace(/\s+/g, '') },
      // Fail fast at every stage, not just the first connection.
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 8000,
    });
  }
  return transporter;
}

// Network errors that mean "this host cannot reach the mail server". They will keep happening.
const UNREACHABLE = new Set(['ETIMEDOUT', 'ESOCKET', 'ECONNECTION', 'ECONNREFUSED', 'ECONNRESET', 'ENETUNREACH', 'EHOSTUNREACH', 'ENOTFOUND', 'EAI_AGAIN', 'SMTP_DEADLINE']);
let skipSmtpUntil = 0;

// Plain-text banner with the code in it. Plain on purpose: log viewers print raw escape codes badly.
function printCodeBanner(email, otp, reason, label = 'LOGIN CODE') {
  const bar = '='.repeat(60);
  console.log(
    [
      '',
      bar,
      `  ${label}  >>>  ${otp}  <<<`,
      `  for ${email}  (valid ${OTP_MINUTES} minutes)`,
      reason ? `  ${reason}` : '',
      bar,
      '',
    ]
      .filter((line, i, all) => line !== '' || i === 0 || i === all.length - 1)
      .join('\n'),
  );
}

// Startup check. Makes NO network call: a blocked SMTP port must never slow down or fail a deploy.
async function checkMailer() {
  if (!emailConfigured()) {
    console.warn('Email not configured (EMAIL_USER / EMAIL_PASS). Login codes will be printed in this log instead of emailed.');
    return;
  }
  console.log(
    `Mailer ready for ${process.env.EMAIL_USER} (not tested at start-up). ` +
      (consoleFallback()
        ? 'If the mail server is unreachable (e.g. Render free tier blocks SMTP), login codes are printed in this log.'
        : 'Console fallback is OFF: if sending fails, login will fail with an error.'),
  );
}

function sendWithDeadline(mail) {
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error(`Mail server did not answer within ${SEND_DEADLINE_MS / 1000}s`), { code: 'SMTP_DEADLINE' })), SEND_DEADLINE_MS);
  });
  return Promise.race([getTransporter().sendMail(mail), deadline]).finally(() => clearTimeout(timer));
}

// Sends the code. Resolves once the user can proceed (mailed, or printed to the log). Rejects only when
// the e-mail failed AND the console fallback is switched off.
// `purpose` is 'login' (the default) or 'reset' (password recovery); it only changes the wording.
async function sendOtpEmail({ name, email }, otp, { purpose = 'login' } = {}) {
  const fallback = consoleFallback();
  const reset = purpose === 'reset';
  const label = reset ? 'PASSWORD RESET CODE' : 'LOGIN CODE';

  if (!emailConfigured()) {
    if (!fallback) throw new Error('Email is not configured and OTP_CONSOLE_FALLBACK is off');
    printCodeBanner(email, otp, 'E-mail is not configured, so the code is shown here.', label);
    return;
  }

  if (Date.now() < skipSmtpUntil && fallback) {
    printCodeBanner(email, otp, 'Mail server was unreachable a moment ago, so the code is shown here.', label);
    return;
  }

  try {
    await sendWithDeadline({
      from: `"${brand.name}" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: reset ? `${brand.name}: your password reset code is ${otp}` : `${brand.name}: your verification code is ${otp}`,
      text: reset
        ? `Hi ${name},\n\nUse this code to reset your password: ${otp}.\nIt expires in ${OTP_MINUTES} minutes. If you did not ask for it, ignore this email: your password has not changed.`
        : `Hi ${name},\n\nYour verification code is ${otp}.\nIt expires in ${OTP_MINUTES} minutes.`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:420px;margin:auto;padding:24px;border:1px solid #e3e7ef;border-radius:8px">
          <h2 style="margin:0 0 4px;color:${brand.navy};font-family:Georgia,serif">${brand.name}</h2>
          <p style="margin:0 0 12px;color:#8a6a2c;font-size:11px;letter-spacing:2px;text-transform:uppercase">${brand.system}</p>
          <p style="color:#444">Hi ${name.replace(/[<>&"]/g, '')}, ${reset ? 'use this code to reset your password:' : 'use this code to finish signing in:'}</p>
          <p style="font-size:32px;letter-spacing:8px;font-weight:bold;color:${brand.navy};margin:16px 0">${otp}</p>
          <p style="color:#666;font-size:13px">It expires in ${OTP_MINUTES} minutes.${reset ? ' If you did not ask for this, ignore this email: your password has not changed.' : ''}</p>
        </div>`,
    });
  } catch (err) {
    const unreachable = UNREACHABLE.has(err.code);
    if (unreachable) {
      skipSmtpUntil = Date.now() + SKIP_SMTP_FOR_MS;
      transporter = undefined; // drop any half-open connection
    }
    // Say what actually went wrong; "blocked port" is only one of the causes.
    const why = unreachable
      ? 'Could not reach the mail server (outbound SMTP is blocked on Render free tier).'
      : err.code === 'EAUTH'
        ? 'Gmail rejected EMAIL_USER / EMAIL_PASS (use a Gmail App Password).'
        : `E-mail failed: ${err.message}`;
    console.error(`[mailer] ${why}`);
    if (!fallback) throw err;
    printCodeBanner(email, otp, why, label);
  }
}

module.exports = { checkMailer, sendOtpEmail };
