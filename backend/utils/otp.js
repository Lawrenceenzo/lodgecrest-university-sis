const crypto = require('crypto');

const OTP_TTL_MS = 5 * 60 * 1000; // a code is valid for 5 minutes
const OTP_RESEND_COOLDOWN_MS = 30 * 1000; // minimum gap between emails
const OTP_MAX_ATTEMPTS = 5; // wrong guesses allowed per code

// Cryptographically secure 6-digit code, leading zeros kept ("004821").
const generateOtp = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');

// Only a keyed hash of the code is stored, so a leaked database doesn't reveal live codes.
const hashOtp = (email, otp) =>
  crypto.createHmac('sha256', process.env.JWT_SECRET).update(`${email}:${otp}`).digest('hex');

const otpMatches = (storedHash, email, otp) => {
  const a = Buffer.from(storedHash, 'hex');
  const b = Buffer.from(hashOtp(email, otp), 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

module.exports = { OTP_TTL_MS, OTP_RESEND_COOLDOWN_MS, OTP_MAX_ATTEMPTS, generateOtp, hashOtp, otpMatches };
