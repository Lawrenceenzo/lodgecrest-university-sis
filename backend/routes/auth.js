const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { EMAIL_RE } = User;
const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/roles');
const { passwordProblems } = require('../utils/password');
const { portalAccessProblem, INACTIVE_MESSAGE } = require('../utils/studentAccess');
const { sendOtpEmail } = require('../utils/mailer');
const {
  OTP_TTL_MS,
  OTP_RESEND_COOLDOWN_MS,
  OTP_MAX_ATTEMPTS,
  generateOtp,
  hashOtp,
  otpMatches,
} = require('../utils/otp');

const router = express.Router();

const BCRYPT_ROUNDS = 10;
// Compared against when the email is unknown so response time doesn't reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_ROUNDS);

const normalizeEmail = (v) => (typeof v === 'string' ? v.trim().toLowerCase() : '');
const clearOtp = (id) => User.updateOne({ _id: id }, { $unset: { otp: 1, otpExpires: 1 }, $set: { otpAttempts: 0 } });

// The role claim lets the client pick the right screen; the server still re-reads the role from
// the database on every request (see middleware/auth.js).
const signToken = (user) => jwt.sign({ id: user.id, role: user.role, tv: user.tokenVersion ?? 0 }, process.env.JWT_SECRET, { expiresIn: '2h' });

// STEP 1 - POST /api/auth/login  { email, password }
// Checks the password, then emails a 6-digit code. No token is issued yet.
router.post('/login', async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = req.body?.password;
  if (!email || typeof password !== 'string' || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  const user = await User.findOne({ email }).select('+password +otpExpires');
  const valid = await bcrypt.compare(password, user ? user.password : DUMMY_HASH);
  if (!user || !valid) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  // Archived / transferred students are turned away here, before a code is e-mailed. (Only reachable
  // with the right password, so this does not reveal which accounts exist.)
  if ((await portalAccessProblem(user)) === 'inactive') {
    return res.status(403).json({ message: INACTIVE_MESSAGE, code: 'ACCOUNT_INACTIVE' });
  }

  // Throttle: a code was emailed very recently (it was issued at otpExpires - TTL).
  if (user.otpExpires) {
    const waitMs = user.otpExpires.getTime() - OTP_TTL_MS + OTP_RESEND_COOLDOWN_MS - Date.now();
    if (waitMs > 0) {
      const retryAfter = Math.ceil(waitMs / 1000);
      return res
        .status(429)
        .json({ message: `Please wait ${retryAfter}s before requesting a new code.`, retryAfter });
    }
  }

  const otp = generateOtp();
  await User.updateOne(
    { _id: user._id },
    { $set: { otp: hashOtp(email, otp), otpExpires: new Date(Date.now() + OTP_TTL_MS), otpAttempts: 0 } },
  );

  try {
    await sendOtpEmail(user, otp);
  } catch (err) {
    console.error('Could not send OTP email:', err.message);
    await clearOtp(user._id); // don't leave a code the user never received
    return res.status(502).json({ message: 'We could not send the verification email. Please try again.' });
  }

  res.json({
    message: 'OTP sent',
    email,
    expiresInSeconds: OTP_TTL_MS / 1000,
    resendAfterSeconds: OTP_RESEND_COOLDOWN_MS / 1000,
  });
});

// STEP 2 - POST /api/auth/verify-otp  { email, otp } -> { token, user }
router.post('/verify-otp', async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const otp = req.body?.otp;
  if (!email || typeof otp !== 'string' || !/^\d{6}$/.test(otp)) {
    return res.status(400).json({ message: 'Enter the 6-digit code from your email' });
  }

  const invalid = () => res.status(401).json({ message: 'Invalid or expired code' });

  const user = await User.findOne({ email }).select('+otp +otpExpires +otpAttempts');
  if (!user || !user.otp || !user.otpExpires) return invalid();

  // Status may have changed since the code was sent.
  if ((await portalAccessProblem(user)) === 'inactive') {
    await clearOtp(user._id);
    return res.status(403).json({ message: INACTIVE_MESSAGE, code: 'ACCOUNT_INACTIVE' });
  }

  if (user.otpExpires.getTime() < Date.now()) {
    await clearOtp(user._id);
    return invalid();
  }

  if (user.otpAttempts >= OTP_MAX_ATTEMPTS) {
    await clearOtp(user._id);
    return res.status(429).json({ message: 'Too many incorrect attempts. Please sign in again to get a new code.' });
  }

  if (!otpMatches(user.otp, email, otp)) {
    const attemptsLeft = OTP_MAX_ATTEMPTS - (user.otpAttempts + 1);
    await User.updateOne({ _id: user._id }, { $inc: { otpAttempts: 1 } });
    return res.status(401).json({
      message: attemptsLeft > 0 ? `Invalid code. ${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} left.` : 'Too many incorrect attempts. Please sign in again to get a new code.',
      attemptsLeft,
    });
  }

  // Consume the code atomically so it can only ever be used once (even with parallel requests).
  const consumed = await User.findOneAndUpdate(
    { _id: user._id, otp: user.otp },
    { $unset: { otp: 1, otpExpires: 1 }, $set: { otpAttempts: 0 } },
  );
  if (!consumed) return invalid();

  res.json({ token: signToken(user), user: user.toJSON() });
});

// ---------------------------------------------------------------------------------------------
// Forgot password: ask for a code by email, then send it back with a new password.
// ---------------------------------------------------------------------------------------------

const clearResetOtp = (id) => User.updateOne({ _id: id }, { $unset: { resetOtp: 1, resetOtpExpires: 1 }, $set: { resetOtpAttempts: 0 } });

// POST /api/auth/forgot-password  { email }
// ALWAYS answers the same way, whether or not the email belongs to an account (and whether or not a code was
// sent), so this cannot be used to find out who has an account. The e-mail itself is sent in the background
// for the same reason: an unknown address must not answer faster than a known one.
router.post('/forgot-password', async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  if (!email || email.length > 100 || !EMAIL_RE.test(email)) return res.status(400).json({ message: 'Enter a valid email address' });

  const user = await User.findOne({ email }).select('+resetOtpExpires');
  // Students who are archived or transferred have no portal access, so there is nothing to recover.
  if (user && !(await portalAccessProblem(user))) {
    // A code was issued moments ago: keep it (and don't flood the inbox) but answer as usual.
    const issuedAt = user.resetOtpExpires ? user.resetOtpExpires.getTime() - OTP_TTL_MS : 0;
    if (Date.now() - issuedAt >= OTP_RESEND_COOLDOWN_MS) {
      const otp = generateOtp();
      await User.updateOne(
        { _id: user._id },
        { $set: { resetOtp: hashOtp(email, otp, 'reset'), resetOtpExpires: new Date(Date.now() + OTP_TTL_MS), resetOtpAttempts: 0 } },
      );
      sendOtpEmail(user, otp, { purpose: 'reset' }).catch((err) => console.error('Could not send the password reset code:', err.message));
    }
  }

  res.json({
    message: 'If that email belongs to an account, a reset code has been sent to it.',
    expiresInSeconds: OTP_TTL_MS / 1000,
    resendAfterSeconds: OTP_RESEND_COOLDOWN_MS / 1000,
  });
});

// POST /api/auth/reset-password  { email, otp, newPassword }
// A wrong, expired, used or never-issued code all answer the same "Invalid or expired code".
router.post('/reset-password', async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const { otp, newPassword } = req.body || {};
  if (!email || typeof otp !== 'string' || !/^\d{6}$/.test(otp)) return res.status(400).json({ message: 'Enter the 6-digit code from your email' });
  if (typeof newPassword !== 'string') return res.status(400).json({ message: 'Enter a new password' });
  // Checked before the code is touched, so a typo in the new password does not use up an attempt.
  const errors = passwordProblems(newPassword);
  if (errors.length) return res.status(400).json({ message: 'Validation failed', errors });

  const invalid = () => res.status(401).json({ message: 'Invalid or expired code' });
  const user = await User.findOne({ email }).select('+resetOtp +resetOtpExpires +resetOtpAttempts');
  if (!user || !user.resetOtp || !user.resetOtpExpires) return invalid();

  if ((await portalAccessProblem(user)) || user.resetOtpExpires.getTime() < Date.now()) {
    await clearResetOtp(user._id);
    return invalid();
  }
  if (user.resetOtpAttempts >= OTP_MAX_ATTEMPTS) {
    await clearResetOtp(user._id);
    return res.status(429).json({ message: 'Too many incorrect attempts. Please request a new code.' });
  }
  if (!otpMatches(user.resetOtp, email, otp, 'reset')) {
    const attemptsLeft = OTP_MAX_ATTEMPTS - (user.resetOtpAttempts + 1);
    await User.updateOne({ _id: user._id }, { $inc: { resetOtpAttempts: 1 } });
    return res.status(401).json({
      message: attemptsLeft > 0 ? `Invalid code. ${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} left.` : 'Too many incorrect attempts. Please request a new code.',
      attemptsLeft,
    });
  }

  // Use the code and change the password in ONE atomic update: the code works once, even with parallel requests.
  // Every earlier session ends (tokenVersion), any pending login code is dropped, and a temporary password is
  // no longer "temporary" because the user has now chosen their own.
  const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  const changed = await User.findOneAndUpdate(
    { _id: user._id, resetOtp: user.resetOtp },
    {
      $set: { password: hash, mustChangePassword: false, passwordChangedAt: new Date(), resetOtpAttempts: 0, otpAttempts: 0 },
      $unset: { resetOtp: 1, resetOtpExpires: 1, otp: 1, otpExpires: 1 },
      $inc: { tokenVersion: 1 },
    },
  );
  if (!changed) return invalid();

  res.json({ message: 'Your password has been updated. You can now sign in.' });
});

// POST /api/auth/register  { name, email, password } -> new user (no password in response)
// Requires a valid admin token: only signed-in admins can create more admin accounts.
router.post('/register', authenticate, requireRole('admin'), async (req, res) => {
  const { name, password } = req.body || {};
  const email = normalizeEmail(req.body?.email);
  const errors = [];

  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 60) errors.push('name must be 2-60 characters');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 100) errors.push('email is invalid');
  errors.push(...passwordProblems(password));
  if (errors.length) return res.status(400).json({ message: 'Validation failed', errors });

  if (await User.exists({ email })) {
    return res.status(409).json({ message: 'A user with this email already exists' });
  }

  const user = await User.create({
    name: name.trim(),
    email,
    password: await bcrypt.hash(password, BCRYPT_ROUNDS),
    role: 'admin', // never taken from the request body
  });
  res.status(201).json(user);
});

// GET /api/auth/me -> current user (lets the frontend restore a session on refresh)
router.get('/me', authenticate.allowPasswordChange, (req, res) => {
  res.json(req.user);
});

// PATCH /api/auth/me  { name } -> change your own display name. Nothing else about the account can be
// changed here: the sign-in e-mail, role and student link are fixed (an e-mail change would redirect
// every login code), so sending a different value is refused instead of quietly ignored.
const NAME_RE = /^[\p{L}][\p{L}\s.'-]*$/u;
router.patch('/me', authenticate, requireRole('admin'), async (req, res) => {
  const body = req.body || {};
  const locked = ['email', 'role', 'student', 'studentId', 'password'].filter((k) => k in body);
  if (locked.length) return res.status(400).json({ message: `${locked.join(', ')} cannot be changed here.`, errors: locked.map((k) => `${k} is read-only`) });

  const name = typeof body.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : '';
  const errors = [];
  if (name.length < 2 || name.length > 60) errors.push('name must be 2-60 characters');
  else if (!NAME_RE.test(name)) errors.push("name may contain letters, spaces, apostrophes, hyphens and periods only");
  if (errors.length) return res.status(400).json({ message: 'Validation failed', errors });

  const user = await User.findByIdAndUpdate(req.user.id, { $set: { name } }, { returnDocument: 'after', runValidators: true });
  return res.json(user.toJSON());
});

// POST /api/auth/change-password  { currentPassword, newPassword } -> { token, user }
// Open to every role, including accounts that still hold a temporary password. Returns a fresh
// token because the change invalidates all earlier ones.
router.post('/change-password', authenticate.allowPasswordChange, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' || !currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Current and new password are required' });
  }
  const errors = passwordProblems(newPassword);
  if (newPassword === currentPassword) errors.push('new password must be different from the current one');
  if (errors.length) return res.status(400).json({ message: 'Validation failed', errors });

  const user = await User.findById(req.user.id).select('+password');
  if (!(await bcrypt.compare(currentPassword, user.password))) {
    return res.status(400).json({ message: 'Current password is incorrect' });
  }

  user.password = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  user.mustChangePassword = false;
  user.passwordChangedAt = new Date();
  user.tokenVersion = (user.tokenVersion ?? 0) + 1; // ends every other session
  await user.save();

  res.json({ token: signToken(user), user: user.toJSON() });
});

module.exports = router;
