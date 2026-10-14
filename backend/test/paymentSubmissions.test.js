// Tests for "submit a payment with proof": the student's submission, the private proof image, and the admin's
// approve / reject step that records the real payment.
//
//   MONGO_TEST_URI="mongodb://127.0.0.1:27017/lodgecrest_test" npm test
//
// Like the other database tests, these ERASE the database they connect to (its name must contain "test").

require('./_env'); // proofs of payment go to a temporary folder (see _env.js)
const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-not-for-production';

const URI = process.env.MONGO_TEST_URI;
const skip = URI ? false : 'set MONGO_TEST_URI to run the database tests';

const models = require('../models');
const { Student, User, Charge, Payment, PaymentSubmission } = models;
const { runSeed } = require('../seed/index');
const { receiptPng } = require('../utils/samplePng');
const { PROOF_DIR } = require('../middleware/uploadProof');
const { purgeStudentRecords } = require('../services/cleanup');
const { computeBalance } = require('../services/accounts');
const app = require('../app');

async function resetDatabase() {
  const name = mongoose.connection.name;
  if (!/test/i.test(name)) throw new Error(`Refusing to erase database "${name}": its name must contain "test".`);
  await mongoose.connection.dropDatabase();
  await Promise.all(Object.values(models).map((M) => M.syncIndexes()));
}

const PNG = receiptPng('1,000.00');
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]), Buffer.alloc(200, 7)]);
const proofFiles = () => fs.readdirSync(PROOF_DIR).filter((f) => f !== '.gitkeep');

describe('payment submissions', { skip }, () => {
  let server;
  let origin;
  let santos;
  let reyes;
  const tokens = {};
  let seq = 0;

  const sign = (user) => jwt.sign({ id: String(user._id), role: user.role, tv: 0 }, process.env.JWT_SECRET, { expiresIn: '1h' });
  async function call(method, path, token, body) {
    const res = await fetch(`${origin}${path}`, {
      method,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}) },
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    });
    const type = res.headers.get('content-type') || '';
    return { status: res.status, headers: res.headers, json: type.includes('json') ? await res.json() : null, bytes: type.includes('json') ? null : Buffer.from(await res.arrayBuffer()) };
  }
  const admin = (method, path, body) => call(method, `/api/payment-submissions${path}`, tokens.admin, body);
  const portal = (method, path, who, body) => call(method, `/api/portal${path}`, tokens[who], body);

  // A valid submission form, with anything overridden. `proof: null` leaves the file out.
  function form(over = {}) {
    seq += 1;
    const f = { amount: '1000', method: 'GCash', referenceNo: `GC-TEST-${String(seq).padStart(4, '0')}`, paidOn: new Date().toISOString().slice(0, 10), note: '', ...over };
    const fd = new FormData();
    for (const [k, v] of Object.entries(f)) if (k !== 'proof' && v !== undefined) fd.append(k, v);
    if (f.proof !== null) {
      const file = over.proof ?? { data: PNG, type: 'image/png', name: 'receipt.png' };
      fd.append(over.field ?? 'proof', new Blob([file.data], { type: file.type }), file.name);
    }
    return fd;
  }
  const submit = (who, over) => portal('POST', '/payments', who, form(over));
  const balanceOf = async (id) => computeBalance(await Charge.find({ student: id }), await Payment.find({ student: id })).balance;

  before(async () => {
    await mongoose.connect(URI);
    await resetDatabase();
    await runSeed({ log: () => {} });
    santos = await Student.findOne({ studentId: '2026-0001' });
    reyes = await Student.findOne({ studentId: '2026-0002' });
    tokens.admin = sign(await User.findOne({ role: 'admin' }));
    tokens.santos = sign(await User.findOne({ role: 'student' }));
    const reyesUser = await User.create({ name: 'John Reyes', email: 'reyes-pay@example.test', password: 'unused-in-tests', role: 'student', student: reyes._id });
    tokens.reyes = sign(reyesUser);
    // Start from a clean queue so the counts below are exact (the seed adds three sample submissions).
    await PaymentSubmission.deleteMany({});
    for (const f of proofFiles()) fs.unlinkSync(`${PROOF_DIR}/${f}`);
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    origin = `http://127.0.0.1:${server.address().port}`;
  });
  after(async () => {
    if (server) {
      server.closeAllConnections?.();
      await new Promise((resolve) => server.close(resolve));
    }
    for (const f of proofFiles()) fs.unlinkSync(`${PROOF_DIR}/${f}`);
    await mongoose.disconnect();
  });

  test('each side is closed to the other: students use /portal, administrators use /payment-submissions', async () => {
    const dummy = new mongoose.Types.ObjectId();
    for (const [method, path] of [['GET', '/payments'], ['POST', '/payments'], ['GET', `/payments/${dummy}/proof`]]) {
      assert.equal((await call(method, `/api/portal${path}`, null)).status, 401, `${method} ${path}`);
      assert.equal((await call(method, `/api/portal${path}`, tokens.admin)).status, 403, `${method} ${path} as admin`);
    }
    for (const [method, path] of [['GET', ''], ['GET', '/summary'], ['GET', `/${dummy}/proof`], ['PUT', `/${dummy}/verify`]]) {
      assert.equal((await call(method, `/api/payment-submissions${path}`, null, method === 'PUT' ? {} : undefined)).status, 401, `${method} ${path}`);
      assert.equal((await call(method, `/api/payment-submissions${path}`, tokens.santos, method === 'PUT' ? {} : undefined)).status, 403, `${method} ${path} as student`);
    }
  });

  test('a submission is stored as Pending with its proof on disk, and changes nothing on the account', async () => {
    const before = { balance: await balanceOf(santos._id), payments: await Payment.countDocuments({ student: santos._id }), files: proofFiles().length };
    const res = await submit('santos', { amount: '1500.50', method: 'Bank Transfer', referenceNo: 'BT-1234-AAAA', note: 'Paid at the BDO branch' });
    assert.equal(res.status, 201);
    assert.deepEqual([res.json.status, res.json.amount, res.json.method, res.json.referenceNo], ['Pending', 1500.5, 'Bank Transfer', 'BT-1234-AAAA']);
    assert.equal(JSON.stringify(res.json).includes('proof'), false, 'the stored file name is never sent out');

    const doc = await PaymentSubmission.findById(res.json.id);
    assert.equal(String(doc.student), String(santos._id));
    assert.match(doc.proof, /^[0-9a-f-]{36}\.png$/, 'a random name, not the uploaded one');
    assert.equal(proofFiles().length, before.files + 1);
    assert.ok(fs.readFileSync(`${PROOF_DIR}/${doc.proof}`).subarray(0, 8).equals(PNG.subarray(0, 8)), 'the image itself was kept');
    assert.deepEqual([await balanceOf(santos._id), await Payment.countDocuments({ student: santos._id })], [before.balance, before.payments], 'nothing is recorded until an administrator approves');
  });

  test('bad submissions are refused with clear reasons and leave no file behind', async () => {
    const files = proofFiles().length;
    const bad = [
      ['no file', { proof: null }, 400],
      ['a text file', { proof: { data: Buffer.from('hello'), type: 'text/plain', name: 'a.txt' } }, 400],
      ['a fake image (text called a PNG)', { proof: { data: Buffer.from('not really a png at all'), type: 'image/png', name: 'a.png' } }, 400],
      ['a GIF', { proof: { data: Buffer.from('GIF89a'), type: 'image/gif', name: 'a.gif' } }, 400],
      ['too big (over 5 MB)', { proof: { data: Buffer.concat([PNG.subarray(0, 8), Buffer.alloc(5 * 1024 * 1024 + 10)]), type: 'image/png', name: 'big.png' } }, 413],
      ['the wrong form field', { field: 'photo' }, 400],
      ['zero amount', { amount: '0' }, 400],
      ['negative amount', { amount: '-5' }, 400],
      ['three decimals', { amount: '12.345' }, 400],
      ['not a number', { amount: 'abc' }, 400],
      ['over the limit', { amount: '600000' }, 400],
      ['a method that is not allowed', { method: 'Scholarship' }, 400],
      ['no reference', { referenceNo: '' }, 400],
      ['a too-short reference', { referenceNo: 'ab' }, 400],
      ['a reference with odd characters', { referenceNo: 'ref;DROP TABLE' }, 400],
      ['a date in the future', { paidOn: '2999-01-01' }, 400],
      ['an impossible date', { paidOn: '2026-02-31' }, 400],
    ];
    for (const [label, over, status] of bad) {
      const r = await submit('santos', over);
      assert.equal(r.status, status, `${label}: ${JSON.stringify(r.json)}`);
      assert.ok(r.json.message, label);
    }
    assert.equal(proofFiles().length, files, 'every refused upload was deleted again');
    assert.equal(await PaymentSubmission.countDocuments({ student: santos._id }), 1, 'only the good one exists');
  });

  test('a reference number can be used only once while it is pending or approved (case ignored)', async () => {
    const files = proofFiles().length;
    const first = await submit('reyes', { referenceNo: 'DUP-REF-0001' });
    assert.equal(first.status, 201);
    for (const who of ['reyes', 'santos']) {
      const again = await submit(who, { referenceNo: 'dup-ref-0001' });
      assert.equal(again.status, 409, `${who} reusing it`);
      assert.match(again.json.message, /already been submitted/);
    }
    assert.equal(proofFiles().length, files + 1, 'the refused uploads left no files');
  });

  test('the proof image is private: only the owner and administrators can read it, never by a public address', async () => {
    const mine = (await portal('GET', '/payments', 'santos')).json.submissions[0];
    const owner = await portal('GET', `/payments/${mine.id}/proof`, 'santos');
    assert.equal(owner.status, 200);
    assert.equal(owner.headers.get('content-type'), 'image/png');
    assert.match(owner.headers.get('cache-control'), /no-store/);
    assert.equal(owner.headers.get('x-content-type-options'), 'nosniff');
    assert.ok(owner.bytes.subarray(0, 8).equals(PNG.subarray(0, 8)));

    assert.equal((await portal('GET', `/payments/${mine.id}/proof`, 'reyes')).status, 404, "someone else's proof");
    assert.equal((await portal('GET', '/payments/not-an-id/proof', 'santos')).status, 404);
    const asAdmin = await admin('GET', `/${mine.id}/proof`);
    assert.deepEqual([asAdmin.status, asAdmin.headers.get('content-type')], [200, 'image/png']);
    assert.equal((await admin('GET', '/..%2F..%2Fpackage.json/proof')).status, 404);

    const stored = (await PaymentSubmission.findById(mine.id)).proof;
    for (const url of [`/uploads/${stored}`, `/private/payment-proofs/${stored}`, `/payment-proofs/${stored}`, `/${stored}`]) {
      assert.equal((await call('GET', url, null)).status, 404, `${url} is not served`);
    }
  });

  test('students see only their own submissions, newest first', async () => {
    const a = (await portal('GET', '/payments', 'santos')).json;
    const b = (await portal('GET', '/payments', 'reyes')).json;
    assert.deepEqual(a.methods, ['Bank Transfer', 'GCash', 'Credit Card', 'Cash']);
    assert.ok(a.submissions.every((x) => x.referenceNo !== 'DUP-REF-0001'));
    assert.deepEqual(b.submissions.map((x) => x.referenceNo), ['DUP-REF-0001']);
    const text = JSON.stringify([a, b]);
    for (const leaked of ['decidedBy', '"student"', 'activeKey', 'proof"']) assert.equal(text.includes(leaked), false, leaked);
  });

  test('at most five payments can wait at once', async () => {
    let last;
    for (let i = 0; i < 6; i += 1) last = await submit('reyes', {});
    // reyes already had one pending (the duplicate test): the 5th overall is the last allowed.
    assert.equal(last.status, 409);
    assert.match(last.json.message, /5 payments waiting/);
    assert.equal(await PaymentSubmission.countDocuments({ student: reyes._id, status: 'Pending' }), 5);
    await PaymentSubmission.deleteMany({ student: reyes._id }); // make room again for later tests
  });

  test('admin list: counts, filters, search, balance on pending ones', async () => {
    const all = (await admin('GET', '?status=all')).json;
    const pending = (await admin('GET', '')).json;
    assert.equal(all.counts.Pending, pending.submissions.length);
    assert.ok(pending.submissions.every((x) => x.status === 'Pending' && typeof x.balance === 'number'));
    const row = pending.submissions.find((x) => x.referenceNo === 'BT-1234-AAAA');
    assert.deepEqual([row.student.studentId, row.amount, row.method, row.paidOn.length], ['2026-0001', 1500.5, 'Bank Transfer', 10]);
    assert.equal(row.balance, await balanceOf(santos._id));
    assert.deepEqual((await admin('GET', '?search=BT-1234')).json.submissions.map((x) => x.referenceNo), ['BT-1234-AAAA']);
    assert.ok((await admin('GET', '?search=santos')).json.submissions.length >= 1);
    assert.equal((await admin('GET', '/summary')).json.pending, pending.submissions.length);
    assert.equal((await admin('GET', '?status=Rejected')).json.submissions.length, 0);
  });

  test('approving records a real payment on the account and the balance drops', async () => {
    const sub = (await PaymentSubmission.findOne({ referenceNo: 'BT-1234-AAAA' }));
    const before = await balanceOf(santos._id);
    const res = await admin('PUT', `/${sub._id}/verify`, { decision: 'Approved' });
    assert.equal(res.status, 200);
    assert.equal(res.json.status, 'Approved');
    assert.equal(res.json.balance, Math.round((before - 1500.5) * 100) / 100);

    const payment = await Payment.findById(res.json.paymentId);
    assert.deepEqual([String(payment.student), payment.amount, payment.method, payment.receiptNo], [String(santos._id), 1500.5, 'Bank Transfer', 'BT-1234-AAAA']);
    assert.match(payment.note, /Submitted online/);
    assert.ok(payment.recordedBy);
    const done = await PaymentSubmission.findById(sub._id);
    assert.deepEqual([done.status, String(done.payment), Boolean(done.decidedAt), Boolean(done.decidedBy)], ['Approved', String(payment._id), true, true]);

    // The student sees it as Approved, and as a payment on the statement of account.
    assert.equal((await portal('GET', '/payments', 'santos')).json.submissions.find((x) => x.referenceNo === 'BT-1234-AAAA').status, 'Approved');
    assert.ok((await portal('GET', '/accounts', 'santos')).json.payments.some((p) => p.receiptNo === 'BT-1234-AAAA' && p.amount === 1500.5));
    assert.equal((await portal('GET', '/accounts', 'santos')).json.balance, res.json.balance);

    // A decision is final, and an approved reference stays used.
    assert.equal((await admin('PUT', `/${sub._id}/verify`, { decision: 'Approved' })).status, 409);
    assert.equal((await admin('PUT', `/${sub._id}/verify`, { decision: 'Rejected', reason: 'Changed my mind' })).status, 409);
    assert.equal((await submit('santos', { referenceNo: 'bt-1234-aaaa' })).status, 409);
    assert.equal(await Payment.countDocuments({ receiptNo: 'BT-1234-AAAA' }), 1);
  });

  test('two administrators approving at the same moment record exactly one payment', async () => {
    const sub = (await submit('reyes', { referenceNo: 'RACE-0001', amount: '700' })).json;
    const results = await Promise.all([1, 2, 3].map(() => admin('PUT', `/${sub.id}/verify`, { decision: 'Approved' })));
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 409, 409]);
    assert.equal(await Payment.countDocuments({ receiptNo: 'RACE-0001' }), 1);
  });

  test('rejecting needs a reason, records it, shows it to the student, and frees the reference', async () => {
    const sub = (await submit('reyes', { referenceNo: 'REJ-0001', amount: '900' })).json;
    const payments = await Payment.countDocuments({ student: reyes._id });
    for (const body of [{ decision: 'Rejected' }, { decision: 'Rejected', reason: '' }, { decision: 'Rejected', reason: 'no' }, { decision: 'Rejected', reason: 'x'.repeat(301) }]) {
      assert.equal((await admin('PUT', `/${sub.id}/verify`, body)).status, 400, JSON.stringify(body).slice(0, 40));
    }
    assert.equal((await PaymentSubmission.findById(sub.id)).status, 'Pending', 'still waiting after the refused attempts');

    const reason = 'The receipt is blurry. Please upload a clearer photo.';
    const res = await admin('PUT', `/${sub.id}/verify`, { decision: 'Rejected', reason });
    assert.deepEqual([res.status, res.json.status], [200, 'Rejected']);
    assert.equal(await Payment.countDocuments({ student: reyes._id }), payments, 'no payment was recorded');
    const mine = (await portal('GET', '/payments', 'reyes')).json.submissions.find((x) => x.id === sub.id);
    assert.deepEqual([mine.status, mine.reason], ['Rejected', reason]);
    assert.equal((await admin('PUT', `/${sub.id}/verify`, { decision: 'Approved' })).status, 409, 'a rejected one cannot be approved afterwards');

    const again = await submit('reyes', { referenceNo: 'REJ-0001', amount: '900' });
    assert.equal(again.status, 201, 'the same reference may be used again after a rejection');
  });

  test('bad decisions, unknown ids, and an archived student', async () => {
    const sub = (await submit('reyes', { referenceNo: 'ARCH-0001' })).json;
    assert.equal((await admin('PUT', `/${sub.id}/verify`, { decision: 'Maybe' })).status, 400);
    assert.equal((await admin('PUT', `/${sub.id}/verify`, {})).status, 400);
    assert.equal((await admin('PUT', `/${new mongoose.Types.ObjectId()}/verify`, { decision: 'Approved' })).status, 404);
    assert.equal((await admin('PUT', '/not-an-id/verify', { decision: 'Approved' })).status, 404);

    await Student.updateOne({ _id: reyes._id }, { academicStatus: 'Archived' });
    const blocked = await admin('PUT', `/${sub.id}/verify`, { decision: 'Approved' });
    assert.equal(blocked.status, 409);
    assert.equal((await PaymentSubmission.findById(sub.id)).status, 'Pending');
    await Student.updateOne({ _id: reyes._id }, { academicStatus: 'Enrolled' });
  });

  test('if the reference already belongs to a recorded payment, approval is refused and the submission goes back to Pending', async () => {
    await Payment.create({ student: santos._id, amount: 10, method: 'Cash', receiptNo: 'OR-TAKEN-1' });
    const sub = (await submit('santos', { referenceNo: 'OR-TAKEN-1', amount: '300' })).json;
    const paymentsBefore = await Payment.countDocuments();
    const res = await admin('PUT', `/${sub.id}/verify`, { decision: 'Approved' });
    assert.equal(res.status, 409);
    assert.match(res.json.message, /already on a recorded payment/);
    const doc = await PaymentSubmission.findById(sub.id);
    assert.deepEqual([doc.status, doc.payment, doc.decidedAt], ['Pending', undefined, undefined]);
    assert.equal(await Payment.countDocuments(), paymentsBefore);
    assert.equal((await admin('PUT', `/${sub.id}/verify`, { decision: 'Rejected', reason: 'Reference already used' })).status, 200, 'it can still be rejected');
  });

  test('deleting a student for good also deletes their proofs from disk', async () => {
    const sub = await PaymentSubmission.findOne({ student: santos._id, status: 'Approved' });
    const file = `${PROOF_DIR}/${sub.proof}`;
    assert.ok(fs.existsSync(file));
    await purgeStudentRecords(santos._id);
    assert.equal(fs.existsSync(file), false);
    assert.equal(await PaymentSubmission.countDocuments({ student: santos._id }), 0);
  });

  test('the seed provides sample submissions with real images (2 waiting, 1 refused)', async () => {
    await resetDatabase();
    await runSeed({ log: () => {} });
    const rows = await PaymentSubmission.find().sort({ submittedAt: 1 });
    assert.deepEqual(rows.map((r) => r.status).sort(), ['Pending', 'Pending', 'Rejected']);
    for (const r of rows) assert.ok(fs.readFileSync(`${PROOF_DIR}/${r.proof}`).subarray(0, 8).equals(PNG.subarray(0, 8)), r.referenceNo);
    assert.match(rows.find((r) => r.status === 'Rejected').reason, /does not match/);
    assert.equal(proofFiles().length, 3);
  });
});
