// Tests for "Forgot password": POST /api/auth/forgot-password and POST /api/auth/reset-password.
//
//   MONGO_TEST_URI="mongodb://127.0.0.1:27017/lodgecrest_test" npm test
//
// Like the other database tests, these ERASE the database they connect to (its name must contain "test").
// No e-mail is configured here, so the mailer prints each code in a banner; the tests read it from there.

require('./_env'); // proofs of payment go to a temporary folder (see _env.js)
const { describe, test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-not-for-production';
delete process.env.EMAIL_USER;
delete process.env.EMAIL_PASS;
delete process.env.OTP_CONSOLE_FALLBACK;

const URI = process.env.MONGO_TEST_URI;
const skip = URI ? false : 'set MONGO_TEST_URI to run the database tests';

const models = require('../models');
const { User, Student } = models;
const { runSeed } = require('../seed/index');
const { hashOtp } = require('../utils/otp');
const app = require('../app');

async function resetDatabase() {
  const name = mongoose.connection.name;
  if (!/test/i.test(name)) throw new Error(`Refusing to erase database "${name}": its name must contain "test".`);
  await mongoose.connection.dropDatabase();
  await Promise.all(Object.values(models).map((M) => M.syncIndexes()));
}

describe('forgot password', { skip }, () => {
  let server;
  let origin;
  let logged;
  const realLog = console.log;
  const EMAIL = 'maria.santos@email.com';
  const OLD = 'student123';

  const post = async (path, body) => {
    const res = await fetch(`${origin}/api/auth/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { status: res.status, json: await res.json().catch(() => null) };
  };
  const forgot = (email = EMAIL) => post('forgot-password', { email });
  const reset = (otp, newPassword = 'Brand-new-pass1', email = EMAIL) => post('reset-password', { email, otp, newPassword });
  const userDoc = () => User.findOne({ email: EMAIL }).select('+password +resetOtp +resetOtpExpires +resetOtpAttempts +otp +otpExpires');

  // The 6-digit code the mailer printed for this address (the mail is sent in the background, so wait for it).
  async function lastCode(email = EMAIL, label = 'PASSWORD RESET CODE', since = 0) {
    for (let i = 0; i < 40; i += 1) {
      const text = logged.slice(since).join('\n');
      const found = [...text.matchAll(new RegExp(`${label}\\s+>>>\\s+(\\d{6})\\s+<<<\\s*\\n\\s*for ${email.replace(/[.]/g, '\\.')}`, 'g'))].pop();
      if (found) return found[1];
      await new Promise((r) => setTimeout(r, 25));
    }
    return null;
  }
  const mark = () => logged.length;

  before(async () => {
    await mongoose.connect(URI);
    await resetDatabase();
    await runSeed({ log: () => {} });
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    origin = `http://127.0.0.1:${server.address().port}`;
  });
  beforeEach(async () => {
    // A clean slate for each test: the seeded password back, no codes, no cool-down.
    await User.updateOne({ email: EMAIL }, { $set: { password: await bcrypt.hash(OLD, 4), mustChangePassword: false }, $unset: { resetOtp: 1, resetOtpExpires: 1, otp: 1, otpExpires: 1 } });
    await Student.updateMany({}, { $set: { academicStatus: 'Enrolled' } });
    logged = [];
    console.log = (...a) => {
      logged.push(a.join(' '));
    };
  });
  after(async () => {
    console.log = realLog;
    if (server) {
      server.closeAllConnections?.();
      await new Promise((resolve) => server.close(resolve));
    }
    await mongoose.disconnect();
  });
  const restoreLog = () => {
    console.log = realLog;
  };

  test('asking for a code stores only a hash, with a 5-minute expiry, and prints/sends the code', async () => {
    const res = await forgot();
    assert.equal(res.status, 200);
    assert.deepEqual([res.json.expiresInSeconds, res.json.resendAfterSeconds], [300, 30]);
    const code = await lastCode();
    assert.match(code, /^\d{6}$/);

    const u = await userDoc();
    assert.notEqual(u.resetOtp, code, 'the code itself is never stored');
    assert.equal(u.resetOtp, hashOtp(EMAIL, code, 'reset'));
    assert.ok(Math.abs(u.resetOtpExpires.getTime() - (Date.now() + 300000)) < 5000, 'expires in about 5 minutes');
    assert.equal(u.otp, undefined, 'the login code is untouched');
    restoreLog();
  });

  test('the answer is identical for known, unknown and archived accounts (no way to find out who has an account)', async () => {
    const known = await forgot();
    const unknown = await forgot('nobody-here@example.test');
    const caps = await forgot(EMAIL.toUpperCase());
    assert.deepEqual(known.json, unknown.json);
    assert.deepEqual(known.status, unknown.status);
    assert.equal(caps.status, 200);
    assert.equal(await User.countDocuments({ email: 'nobody-here@example.test' }), 0, 'nothing is created');

    await Student.updateOne({ _id: (await User.findOne({ email: EMAIL })).student }, { academicStatus: 'Archived' });
    await User.updateOne({ email: EMAIL }, { $unset: { resetOtp: 1, resetOtpExpires: 1 } });
    const before = mark();
    const archived = await forgot();
    assert.deepEqual(archived.json, known.json);
    assert.equal(await lastCode(EMAIL, 'PASSWORD RESET CODE', before), null, 'no code goes to an archived student');
    assert.equal((await userDoc()).resetOtp, undefined);
    restoreLog();
  });

  test('bad input: a malformed email is a 400 for everyone', async () => {
    for (const email of ['', 'not-an-email', undefined, 42, `${'a'.repeat(120)}@x.co`]) {
      assert.equal((await post('forgot-password', { email })).status, 400, String(email).slice(0, 20));
    }
    restoreLog();
  });

  test('asking again within 30 seconds does not replace the code or send another', async () => {
    await forgot();
    const first = (await userDoc()).resetOtp;
    const mid = mark();
    assert.equal((await forgot()).status, 200);
    assert.equal((await userDoc()).resetOtp, first);
    assert.equal(await lastCode(EMAIL, 'PASSWORD RESET CODE', mid), null);

    // After the cool-down a new request issues a new code.
    await User.updateOne({ email: EMAIL }, { $set: { resetOtpExpires: new Date(Date.now() + 300000 - 31000) } });
    await forgot();
    assert.notEqual((await userDoc()).resetOtp, first);
    restoreLog();
  });

  test('the full flow: code + a valid new password changes it, and the old password stops working', async () => {
    await forgot();
    const code = await lastCode();
    const done = await reset(code, 'Brand-new-pass1');
    assert.equal(done.status, 200);
    assert.match(done.json.message, /updated/);

    const u = await userDoc();
    assert.ok(await bcrypt.compare('Brand-new-pass1', u.password), 'stored as a bcrypt hash of the new password');
    assert.notEqual(u.password, 'Brand-new-pass1');
    assert.equal(u.resetOtp, undefined);
    assert.equal(u.resetOtpExpires, undefined);

    assert.equal((await post('login', { email: EMAIL, password: OLD })).status, 401, 'old password refused');
    assert.equal((await post('login', { email: EMAIL, password: 'Brand-new-pass1' })).status, 200, 'new password accepted (the usual emailed code follows)');
    restoreLog();
  });

  test('the code works once, and ends every earlier session', async () => {
    const user = await userDoc();
    const oldToken = jwt.sign({ id: String(user._id), role: user.role, tv: user.tokenVersion ?? 0 }, process.env.JWT_SECRET, { expiresIn: '1h' });
    assert.equal((await fetch(`${origin}/api/auth/me`, { headers: { Authorization: `Bearer ${oldToken}` } })).status, 200);

    await forgot();
    const code = await lastCode();
    assert.equal((await reset(code)).status, 200);
    const again = await reset(code, 'Another-pass2');
    assert.deepEqual([again.status, again.json.message], [401, 'Invalid or expired code']);
    assert.ok(await bcrypt.compare('Brand-new-pass1', (await userDoc()).password), 'the second use changed nothing');
    assert.equal((await fetch(`${origin}/api/auth/me`, { headers: { Authorization: `Bearer ${oldToken}` } })).status, 401, 'the old session is signed out');
    restoreLog();
  });

  test('a weak password is refused without using up the code or an attempt', async () => {
    await forgot();
    const code = await lastCode();
    for (const weak of ['short1', 'allletters', '12345678', '', 'x'.repeat(80) + '1']) {
      const r = await reset(code, weak);
      assert.equal(r.status, 400, weak.slice(0, 12));
      assert.ok(r.json.errors?.length || r.json.message);
    }
    assert.equal((await userDoc()).resetOtpAttempts, 0);
    assert.equal((await reset(code, 'Strong-pass9')).status, 200, 'the same code still works afterwards');
    restoreLog();
  });

  test('wrong codes: counted, then the code is cancelled after 5 tries', async () => {
    await forgot();
    const code = await lastCode();
    const wrong = code === '000000' ? '111111' : '000000';
    const first = await reset(wrong);
    assert.deepEqual([first.status, first.json.attemptsLeft], [401, 4]);
    for (let i = 0; i < 3; i += 1) await reset(wrong);
    const fifth = await reset(wrong);
    assert.deepEqual([fifth.status, fifth.json.attemptsLeft], [401, 0]);
    const locked = await reset(code); // even the right code is refused now
    assert.equal(locked.status, 429);
    assert.equal((await userDoc()).resetOtp, undefined, 'the code was cancelled');
    assert.equal((await reset(code)).status, 401);
    assert.ok(await bcrypt.compare(OLD, (await userDoc()).password), 'the password never changed');
    restoreLog();
  });

  test('expired, unknown-account and never-requested all look the same', async () => {
    await forgot();
    const code = await lastCode();
    await User.updateOne({ email: EMAIL }, { $set: { resetOtpExpires: new Date(Date.now() - 1000) } });
    const expired = await reset(code);
    assert.deepEqual([expired.status, expired.json.message], [401, 'Invalid or expired code']);
    assert.equal((await userDoc()).resetOtp, undefined, 'an expired code is removed');

    const neverAsked = await reset('123456');
    const stranger = await reset('123456', 'Brand-new-pass1', 'nobody-here@example.test');
    assert.deepEqual([neverAsked.status, neverAsked.json], [401, expired.json]);
    assert.deepEqual([stranger.status, stranger.json], [401, expired.json]);

    for (const bad of [{ otp: '12345' }, { otp: 123456 }, { otp: 'abcdef' }, {}]) {
      assert.equal((await post('reset-password', { email: EMAIL, newPassword: 'Brand-new-pass1', ...bad })).status, 400, JSON.stringify(bad));
    }
    assert.equal((await post('reset-password', { email: EMAIL, otp: '123456' })).status, 400, 'a missing new password');
    restoreLog();
  });

  test('a reset code cannot sign you in, and a login code cannot reset a password', async () => {
    await forgot();
    const resetCode = await lastCode();
    assert.equal((await post('verify-otp', { email: EMAIL, otp: resetCode })).status, 401, 'a reset code is not a login code');

    const mid = mark();
    assert.equal((await post('login', { email: EMAIL, password: OLD })).status, 200);
    const loginCode = await lastCode(EMAIL, 'LOGIN CODE', mid);
    assert.match(loginCode, /^\d{6}$/);
    assert.equal((await reset(loginCode)).status, 401, 'a login code is not a reset code');
    assert.ok(await bcrypt.compare(OLD, (await userDoc()).password));

    // Both are independent: using one leaves the other alone.
    assert.equal((await reset(resetCode)).status, 200);
    restoreLog();
  });

  test('a student who becomes archived after asking cannot finish the reset', async () => {
    await forgot();
    const code = await lastCode();
    await Student.updateOne({ _id: (await User.findOne({ email: EMAIL })).student }, { academicStatus: 'Transferred' });
    assert.equal((await reset(code)).status, 401);
    assert.ok(await bcrypt.compare(OLD, (await userDoc()).password));
    restoreLog();
  });

  test('a temporary password is replaced: the account is no longer forced to change it', async () => {
    await User.updateOne({ email: EMAIL }, { $set: { mustChangePassword: true } });
    await forgot();
    assert.equal((await reset(await lastCode())).status, 200);
    assert.equal((await userDoc()).mustChangePassword, false);
    restoreLog();
  });
});
