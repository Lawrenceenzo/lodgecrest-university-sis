// Tests for the login-code mailer: no network at start-up, a bounded wait when SMTP is blocked, and the
// log banner fallback. The mail transport is replaced with a stub, so nothing here sends e-mail.

require('./_env'); // proofs of payment go to a temporary folder (see _env.js)
const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const nodemailer = require('nodemailer');

const MAILER = require.resolve('../utils/mailer');
const realCreate = nodemailer.createTransport;
const saved = { ...process.env };
let sendMail; // what the stub transport does
let created; // how many transports were created
let log;
let realLog;
let realWarn;
let realError;

function loadMailer() {
  delete require.cache[MAILER];
  return require('../utils/mailer');
}

beforeEach(() => {
  process.env.SMTP_SEND_TIMEOUT_MS = '150';
  process.env.EMAIL_USER = 'sender@example.test';
  process.env.EMAIL_PASS = 'abcd efgh ijkl mnop';
  delete process.env.OTP_CONSOLE_FALLBACK;
  created = 0;
  sendMail = async () => ({ accepted: ['x'] });
  nodemailer.createTransport = () => {
    created += 1;
    return { sendMail: (mail) => sendMail(mail) };
  };
  log = [];
  realLog = console.log;
  realWarn = console.warn;
  realError = console.error;
  console.log = (...a) => log.push(a.join(' '));
  console.warn = (...a) => log.push(a.join(' '));
  console.error = (...a) => log.push(a.join(' '));
});
afterEach(() => {
  console.log = realLog;
  console.warn = realWarn;
  console.error = realError;
  nodemailer.createTransport = realCreate;
  for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
  Object.assign(process.env, saved);
});

const user = { name: 'Maria', email: 'maria@example.test' };
const banner = () => log.join('\n');
const timeout = () => Object.assign(new Error('connect ETIMEDOUT'), { code: 'ETIMEDOUT' });

describe('mailer', () => {
  test('start-up check makes no network call and never throws, configured or not', async () => {
    const { checkMailer } = loadMailer();
    await checkMailer();
    assert.equal(created, 0, 'no transport is even created');
    assert.match(banner(), /not tested at start-up/);

    delete process.env.EMAIL_PASS;
    await loadMailer().checkMailer();
    assert.match(banner(), /printed in this log/);
    assert.equal(created, 0);
  });

  test('a delivered e-mail prints nothing', async () => {
    const mails = [];
    sendMail = async (m) => mails.push(m);
    await loadMailer().sendOtpEmail(user, '123456');
    assert.equal(mails.length, 1);
    assert.equal(mails[0].to, 'maria@example.test');
    assert.match(mails[0].subject, /123456/);
    assert.equal(log.length, 0, 'the code is not written to the log when it was mailed');
  });

  test('blocked SMTP: login still succeeds and the 6-digit code is printed in a banner', async () => {
    sendMail = async () => {
      throw timeout();
    };
    await loadMailer().sendOtpEmail(user, '482913');
    assert.match(banner(), /LOGIN CODE\s+>>>\s+482913\s+<<</);
    assert.match(banner(), /maria@example\.test/);
    assert.match(banner(), /Could not reach the mail server/);
  });

  test('a server that never answers is cut off at the deadline instead of hanging the login', async () => {
    sendMail = () => new Promise(() => {}); // never settles
    const started = Date.now();
    await loadMailer().sendOtpEmail(user, '111222');
    assert.ok(Date.now() - started < 2000, 'returned quickly');
    assert.match(banner(), />>>\s+111222\s+<<</);
  });

  test('after SMTP proved unreachable, the next logins skip it and answer at once', async () => {
    let attempts = 0;
    sendMail = async () => {
      attempts += 1;
      throw timeout();
    };
    const { sendOtpEmail } = loadMailer();
    await sendOtpEmail(user, '000001');
    await sendOtpEmail(user, '000002');
    assert.equal(attempts, 1, 'only the first login tried SMTP');
    assert.match(banner(), />>>\s+000002\s+<<</);
    assert.match(banner(), /unreachable a moment ago/);
  });

  test('a wrong Gmail password is reported as that, not as a blocked port, and the code is still shown', async () => {
    sendMail = async () => {
      throw Object.assign(new Error('Invalid login'), { code: 'EAUTH' });
    };
    const { sendOtpEmail } = loadMailer();
    await sendOtpEmail(user, '654321');
    assert.match(banner(), /App Password/);
    assert.doesNotMatch(banner(), /blocked on Render/);
    await sendOtpEmail(user, '654322');
    assert.equal(created >= 1, true);
    assert.doesNotMatch(banner(), /moment ago/, 'a credentials problem does not switch SMTP off');
  });

  test('e-mail not configured: the code goes to the log', async () => {
    delete process.env.EMAIL_USER;
    await loadMailer().sendOtpEmail(user, '909090');
    assert.match(banner(), />>>\s+909090\s+<<</);
    assert.equal(created, 0);
  });

  test('OTP_CONSOLE_FALLBACK=false: failures are thrown (so the login answers 502) and the code is never logged', async () => {
    process.env.OTP_CONSOLE_FALLBACK = 'false';
    sendMail = async () => {
      throw timeout();
    };
    await assert.rejects(loadMailer().sendOtpEmail(user, '777888'), { code: 'ETIMEDOUT' });
    assert.doesNotMatch(banner(), /777888/);

    delete process.env.EMAIL_USER;
    await assert.rejects(loadMailer().sendOtpEmail(user, '777889'), /not configured/);
    assert.doesNotMatch(banner(), /777889/);
  });

  test('a password-reset code says so in the e-mail, and in the log banner when the mail cannot be sent', async () => {
    const mails = [];
    sendMail = async (m) => mails.push(m);
    await loadMailer().sendOtpEmail(user, '246810', { purpose: 'reset' });
    assert.match(mails[0].subject, /password reset code is 246810/);
    assert.match(mails[0].text, /reset your password: 246810/);
    assert.match(mails[0].text, /your password has not changed/);
    assert.equal(log.length, 0);

    sendMail = async () => {
      throw timeout();
    };
    await loadMailer().sendOtpEmail(user, '135790', { purpose: 'reset' });
    assert.match(banner(), /PASSWORD RESET CODE\s+>>>\s+135790\s+<<</);
    assert.doesNotMatch(banner(), /LOGIN CODE/);

    // The default is still the sign-in wording.
    mails.length = 0;
    sendMail = async (m) => mails.push(m);
    await loadMailer().sendOtpEmail(user, '111111');
    assert.match(mails[0].subject, /verification code is 111111/);
  });
});
