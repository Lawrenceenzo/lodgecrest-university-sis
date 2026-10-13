// Tests for pre-enrollment: the student's picker rules (portal) and the admin approval queue.
//
//   MONGO_TEST_URI="mongodb://127.0.0.1:27017/lodgecrest_test" npm test
//
// Like the other database tests, these ERASE the database they connect to (its name must contain "test").

const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-not-for-production';

const URI = process.env.MONGO_TEST_URI;
const skip = URI ? false : 'set MONGO_TEST_URI to run the database tests';

const models = require('../models');
const { Student, User, Term, Subject, Offering, Enrollment, Hold, PreEnrollment } = models;
const { runSeed } = require('../seed/index');
const app = require('../app');

async function resetDatabase() {
  const name = mongoose.connection.name;
  if (!/test/i.test(name)) throw new Error(`Refusing to erase database "${name}": its name must contain "test".`);
  await mongoose.connection.dropDatabase();
  await Promise.all(Object.values(models).map((M) => M.syncIndexes()));
}

describe('pre-enrollment', { skip }, () => {
  let server;
  let origin;
  let next; // the term open for pre-enrollment
  let current;
  const S = {};
  const tokens = {};
  let adminId;

  const sign = (user) => jwt.sign({ id: String(user._id), role: user.role, tv: user.tokenVersion ?? 0 }, process.env.JWT_SECRET, { expiresIn: '1h' });
  async function call(method, path, token, body) {
    const res = await fetch(origin + path, {
      method,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, json: await res.json().catch(() => null) };
  }
  const portal = (method, path, who, body) => call(method, `/api/portal${path}`, tokens[who], body);
  const admin = (method, path, body) => call(method, `/api/pre-enrollments${path}`, tokens.admin, body);

  const loginFor = async (number) => {
    const s = S[number];
    const user = await User.create({ name: `${s.firstName} ${s.lastName}`, email: `pre-${number}@example.test`, password: 'not-used-in-these-tests', role: 'student', student: s._id });
    tokens[number] = sign(user);
  };
  const offeringOf = async (code, section = 'A', term = next) => Offering.findOne({ term: term._id, subject: (await Subject.findOne({ code }))._id, section });
  const ids = async (codes, section = 'A') => (await Promise.all(codes.map((c) => offeringOf(c, section)))).map((o) => String(o._id));
  let slot = 0;
  const makeOffering = async (code, over = {}) => {
    slot += 1;
    const subject = await Subject.findOne({ code });
    return Offering.create({ term: next._id, subject: subject._id, section: 'Z', professor: 'Prof. Test', meetings: [{ day: 'Sat', start: `${String(6 + slot).padStart(2, '0')}:00`, end: `${String(7 + slot).padStart(2, '0')}:00` }], ...over });
  };
  const makeSubject = (code, over = {}) => Subject.create({ code, title: `Test subject ${code}`, units: 3, ...over });

  before(async () => {
    await mongoose.connect(URI);
    await resetDatabase();
    await runSeed({ log: () => {} });
    for (const s of await Student.find()) S[s.studentId] = s;
    next = await Term.findOne({ enrollmentOpen: true });
    current = await Term.findOne({ isCurrent: true });
    const adminUser = await User.findOne({ role: 'admin' });
    adminId = String(adminUser._id);
    tokens.admin = sign(adminUser);
    tokens['2026-0001'] = sign(await User.findOne({ role: 'student' }));
    for (const n of ['2026-0002', '2026-0003', '2026-0004']) await loginFor(n);
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    origin = `http://127.0.0.1:${server.address().port}`;
  });
  after(async () => {
    if (server) {
      server.closeAllConnections?.();
      await new Promise((resolve) => server.close(resolve));
    }
    await mongoose.disconnect();
  });

  test('only the right role gets in: students on the portal, administrators on the queue', async () => {
    const dummy = new mongoose.Types.ObjectId();
    const studentSide = [['GET', '/pre-enrollment'], ['GET', '/pre-enrollment/offerings'], ['POST', '/pre-enrollment/validate'], ['POST', '/pre-enrollment'], ['DELETE', `/pre-enrollment/${dummy}`]];
    for (const [method, path] of studentSide) {
      assert.equal((await call(method, `/api/portal${path}`, null, method === 'GET' ? undefined : {})).status, 401, `${method} ${path} without a token`);
      assert.equal((await call(method, `/api/portal${path}`, tokens.admin, method === 'GET' ? undefined : {})).status, 403, `${method} ${path} as an administrator`);
    }
    const adminSide = [['GET', ''], ['GET', '/summary'], ['POST', `/${dummy}/approve`], ['POST', `/${dummy}/reject`]];
    for (const [method, path] of adminSide) {
      assert.equal((await call(method, `/api/pre-enrollments${path}`, null, method === 'GET' ? undefined : {})).status, 401, `${method} ${path} without a token`);
      assert.equal((await call(method, `/api/pre-enrollments${path}`, tokens['2026-0001'], method === 'GET' ? undefined : {})).status, 403, `${method} ${path} as a student`);
    }
    assert.equal((await call('PATCH', `/api/terms/${next._id}`, tokens['2026-0001'], { enrollmentOpen: false })).status, 403);
  });

  test('state: limits, the open term, and who may submit (a Library hold only warns; an Accounting hold blocks)', async () => {
    const santos = (await portal('GET', '/pre-enrollment', '2026-0001')).json;
    assert.equal(santos.term.name, '2026-2027 2nd Semester');
    assert.equal(santos.canSubmit, true);
    assert.deepEqual(santos.limits, { maxUnits: 24, regularMinUnits: 12 });
    assert.equal(santos.pending, null);
    assert.deepEqual(santos.history, []);
    assert.deepEqual(santos.notices.map((n) => n.code), ['HOLD_ADVISORY'], 'Santos has a Library hold: shown, not blocking');

    const reyes = (await portal('GET', '/pre-enrollment', '2026-0002')).json;
    assert.equal(reyes.canSubmit, false);
    assert.deepEqual(reyes.blockers.map((b) => b.code), ['ALREADY_PENDING']);
    assert.equal(reyes.pending.status, 'Pending');
    assert.equal(reyes.pending.totalUnits, 17);
    assert.equal(reyes.pending.items.length, 6);

    const cruz = (await portal('GET', '/pre-enrollment', '2026-0003')).json;
    assert.deepEqual(cruz.blockers.map((b) => b.code), ['HOLD']);
    assert.match(cruz.blockers[0].message, /Accounting/);
  });

  test('picker: each class is judged for this student (conditional prerequisites warn, others block)', async () => {
    const { term, offerings } = (await portal('GET', '/pre-enrollment/offerings', '2026-0001')).json;
    assert.equal(term.name, '2026-2027 2nd Semester');
    const find = (code, section = 'A') => offerings.find((o) => o.subject.code === code && o.section === section);

    const recommended = offerings.filter((o) => o.recommended).map((o) => o.subject.code);
    assert.deepEqual([...new Set(recommended)].sort(), ['GE107', 'IT204', 'IT205', 'IT206', 'IT207', 'PE4'], 'the 2nd-year 2nd-semester BSIT subjects');
    assert.equal(offerings.find((o) => o.subject.code === 'GE102').recommended, false, 'a first-year subject is not recommended to a second-year student');

    const pe4 = find('PE4');
    assert.deepEqual([pe4.selectable, pe4.problems.length, pe4.warnings.length], [true, 0, 0]);
    assert.equal(pe4.subject.units, 2);
    assert.equal(pe4.seatsLeft, pe4.capacity - 0);

    const it204 = find('IT204'); // needs IT201, which Santos is taking right now
    assert.equal(it204.selectable, true);
    assert.deepEqual(it204.warnings.map((w) => w.code), ['PREREQUISITE_CONDITIONAL']);
    assert.deepEqual(it204.subject.prerequisites, ['IT201']);
    assert.ok(find('IT204', 'B'), 'BSIT has a second section to choose from');

    // Extra classes, one for each reason a class can be refused.
    const passed = await makeOffering('GE101'); // Santos passed it last year
    const missing = await makeOffering('IT401'); // needs IT302, which he has neither passed nor started
    const closed = await makeOffering('IT308', { status: 'Closed' });
    const full = await makeOffering('IT309', { capacity: 1, enrolledCount: 1 });
    const all = (await portal('GET', '/pre-enrollment/offerings', '2026-0001')).json.offerings;
    const codesOf = (code) => all.find((o) => o.subject.code === code && o.section === 'Z').problems.map((p) => p.code);
    assert.deepEqual(codesOf('GE101'), ['ALREADY_PASSED']);
    assert.deepEqual(codesOf('IT401'), ['PREREQUISITE_NOT_MET']);
    assert.deepEqual(codesOf('IT308'), ['OFFERING_CLOSED']);
    assert.deepEqual(codesOf('IT309'), ['OFFERING_FULL']);
    assert.ok([passed, missing, closed, full].every(Boolean));

    const found = (await portal('GET', '/pre-enrollment/offerings?search=web', '2026-0001')).json.offerings;
    assert.ok(found.length >= 1 && found.every((o) => /web/i.test(o.subject.title) || /web/i.test(o.subject.code)));
    assert.equal((await portal('GET', '/pre-enrollment/offerings?search=%5B', '2026-0001')).status, 200, 'regex characters are harmless');
    await Offering.deleteMany({ section: 'Z' });
  });

  test('validate: unit limit, part-time warning, clashes, duplicates, mixed terms, bad input', async () => {
    const good = await ids(['GE107', 'IT204', 'IT205', 'IT206', 'PE4']);
    const ok = (await portal('POST', '/pre-enrollment/validate', '2026-0001', { offeringIds: good })).json;
    assert.equal(ok.ok, true);
    assert.equal(ok.totalUnits, 14);
    assert.deepEqual(ok.problems, []);
    assert.deepEqual(ok.warnings.map((w) => w.code).sort(), ['HOLD_ADVISORY', 'PREREQUISITE_CONDITIONAL']);

    const part = (await portal('POST', '/pre-enrollment/validate', '2026-0001', { offeringIds: await ids(['GE107']) })).json;
    assert.equal(part.ok, true, 'a light load is allowed');
    assert.ok(part.warnings.some((w) => w.code === 'UNDER_LOAD'));

    assert.deepEqual((await portal('POST', '/pre-enrollment/validate', '2026-0001', { offeringIds: [] })).json.problems.map((p) => p.code), ['NO_SUBJECTS']);

    // Too many units: five 6-unit subjects (30 units) at times that do not overlap.
    const bigOfferings = [];
    for (let i = 1; i <= 5; i += 1) {
      await makeSubject(`BIG${i}`, { units: 6 });
      bigOfferings.push(String((await makeOffering(`BIG${i}`))._id));
    }
    const over = (await portal('POST', '/pre-enrollment/validate', '2026-0001', { offeringIds: bigOfferings })).json;
    assert.equal(over.ok, false);
    assert.deepEqual(over.problems.map((p) => p.code), ['UNIT_LIMIT']);
    assert.match(over.problems[0].message, /30 units.*maximum is 24/);
    const exactly = (await portal('POST', '/pre-enrollment/validate', '2026-0001', { offeringIds: bigOfferings.slice(0, 4) })).json;
    assert.equal(exactly.ok, true, '24 units is allowed');

    // Two different subjects at the very same time.
    const sameTime = [{ day: 'Sat', start: '20:00', end: '21:00' }];
    const a = await makeOffering('BIG1', { section: 'Y', meetings: sameTime });
    const b = await makeOffering('BIG2', { section: 'Y', meetings: sameTime });
    const clash = (await portal('POST', '/pre-enrollment/validate', '2026-0001', { offeringIds: [String(a._id), String(b._id)] })).json;
    assert.deepEqual(clash.problems.map((p) => p.code), ['SCHEDULE_CONFLICT']);
    assert.match(clash.problems[0].message, /BIG1 \(Y\) and BIG2 \(Y\)/);

    // The same subject twice (sections A and B).
    const dupe = (await portal('POST', '/pre-enrollment/validate', '2026-0001', { offeringIds: [...(await ids(['GE107'], 'A')), ...(await ids(['GE107'], 'B'))] })).json;
    assert.ok(dupe.problems.some((p) => p.code === 'DUPLICATE_SUBJECT'));

    // A class from another term.
    const now = await offeringOf('IT201', 'A', current);
    const mixed = (await portal('POST', '/pre-enrollment/validate', '2026-0001', { offeringIds: [String(now._id), ...(await ids(['GE107']))] })).json;
    assert.ok(mixed.problems.some((p) => p.code === 'MIXED_TERMS'));

    for (const bad of [undefined, 'x', ['not-an-id'], Array.from({ length: 13 }, () => String(new mongoose.Types.ObjectId())), [{ $ne: null }]]) {
      assert.equal((await portal('POST', '/pre-enrollment/validate', '2026-0001', { offeringIds: bad })).status, 400, JSON.stringify(bad)?.slice(0, 40));
    }
    await Offering.deleteMany({ section: { $in: ['Z', 'Y'] } });
  });

  test('submit: an invalid request is refused with the reasons; nothing is saved', async () => {
    const dupe = [...(await ids(['GE107'], 'A')), ...(await ids(['GE107'], 'B'))];
    const res = await portal('POST', '/pre-enrollment', '2026-0001', { offeringIds: dupe });
    assert.deepEqual([res.status, res.json.code], [409, 'PREENROLL_INVALID']);
    assert.ok(res.json.problems.length >= 1);
    assert.equal(await PreEnrollment.countDocuments({ student: S['2026-0001']._id }), 0);

    // A student with an Accounting hold is turned away, whatever they pick.
    const cruz = await portal('POST', '/pre-enrollment', '2026-0003', { offeringIds: await ids(['GE107']) });
    assert.equal(cruz.status, 409);
    assert.ok(cruz.json.problems.some((p) => p.code === 'HOLD'));
    // So is a student on leave.
    await Student.updateOne({ _id: S['2026-0004']._id }, { academicStatus: 'LOA' });
    const loa = await portal('POST', '/pre-enrollment', '2026-0004', { offeringIds: await ids(['GE107']) });
    assert.ok(loa.json.problems.some((p) => p.code === 'STUDENT_NOT_ACTIVE'));
    await Student.updateOne({ _id: S['2026-0004']._id }, { academicStatus: 'Enrolled' });
  });

  test('submit, then cancel: only your own pending request, and only once', async () => {
    const picks = await ids(['GE107', 'IT204', 'IT205', 'IT206', 'PE4']);
    const sent = await portal('POST', '/pre-enrollment', '2026-0001', { offeringIds: picks });
    assert.equal(sent.status, 201);
    assert.equal(sent.json.status, 'Pending');
    assert.equal(sent.json.totalUnits, 14);
    assert.deepEqual(sent.json.items.map((i) => i.code).sort(), ['GE107', 'IT204', 'IT205', 'IT206', 'PE4']);
    assert.equal(await Enrollment.countDocuments({ student: S['2026-0001']._id, term: next._id }), 0, 'nothing is enrolled until an admin approves');
    assert.equal((await Offering.findById(picks[0])).enrolledCount, 0, 'and no seat is taken');

    const again = await portal('POST', '/pre-enrollment', '2026-0001', { offeringIds: picks });
    assert.deepEqual([again.status, again.json.code], [409, 'ALREADY_PENDING']);
    assert.equal(await PreEnrollment.countDocuments({ student: S['2026-0001']._id, status: 'Pending' }), 1, 'still just one request waiting');

    const state = (await portal('GET', '/pre-enrollment', '2026-0001')).json;
    assert.deepEqual(state.blockers.map((b) => b.code), ['ALREADY_PENDING']);
    assert.equal(state.pending.id, sent.json.id);
    const dash = (await portal('GET', '/dashboard', '2026-0001')).json.alerts.map((a) => a.code);
    assert.ok(dash.includes('PRE_ENROLLMENT_PENDING') && !dash.includes('PRE_ENROLLMENT_OPEN'));

    // Someone else's request is invisible: 404, and it stays pending.
    const reyesRequest = await PreEnrollment.findOne({ student: S['2026-0002']._id });
    assert.equal((await portal('DELETE', `/pre-enrollment/${reyesRequest._id}`, '2026-0001')).status, 404);
    assert.equal((await PreEnrollment.findById(reyesRequest._id)).status, 'Pending');
    assert.equal((await portal('DELETE', '/pre-enrollment/not-an-id', '2026-0001')).status, 404);

    // The admin sees it, with its review: fine to approve once conditional prerequisites are accepted.
    const queued = (await admin('GET', '?status=Pending')).json.requests.find((r) => r.id === sent.json.id);
    assert.equal(queued.student.studentId, '2026-0001');
    assert.equal(queued.review.ok, true);
    assert.ok(queued.review.warnings.some((w) => w.code === 'PREREQUISITE_CONDITIONAL'));

    assert.equal((await portal('DELETE', `/pre-enrollment/${sent.json.id}`, '2026-0001')).status, 200);
    const second = await portal('DELETE', `/pre-enrollment/${sent.json.id}`, '2026-0001');
    assert.deepEqual([second.status, second.json.code], [409, 'NOT_PENDING']);
    const history = (await portal('GET', '/pre-enrollment', '2026-0001')).json;
    assert.equal(history.pending, null);
    assert.equal(history.history[0].status, 'Cancelled');
    assert.equal(history.canSubmit, true, 'free to submit again');
  });

  test('the student\'s view of requests carries no staff or database details', async () => {
    const text = JSON.stringify((await portal('GET', '/pre-enrollment', '2026-0002')).json);
    for (const leaked of ['decidedBy', 'student"', '_id', 'password']) assert.equal(text.includes(leaked), false, leaked);
  });

  test('queue: counts, filters, search and a live review for each pending request', async () => {
    const { counts, requests } = (await admin('GET', '')).json;
    assert.equal(counts.Pending, 2);
    assert.equal(counts.Cancelled, 1);
    assert.deepEqual(requests.map((r) => r.student.studentId), ['2026-0004', '2026-0002'], 'oldest first');
    const reyes = requests.find((r) => r.student.studentId === '2026-0002');
    assert.deepEqual([reyes.term.name, reyes.totalUnits, reyes.items.length], ['2026-2027 2nd Semester', 17, 6]);
    assert.equal(reyes.review.ok, true);
    assert.ok(reyes.review.warnings.filter((w) => w.code === 'PREREQUISITE_CONDITIONAL').length >= 3, 'CS103, PE2 and NSTP2 depend on classes in progress');
    assert.ok(reyes.items[0].meetings.length > 0 && reyes.items[0].professor);

    assert.equal((await admin('GET', '?status=Cancelled')).json.requests.length, 1);
    assert.equal((await admin('GET', '?status=all')).json.requests.length, 3);
    assert.deepEqual((await admin('GET', '?search=reyes')).json.requests.map((r) => r.student.studentId), ['2026-0002']);
    assert.deepEqual((await admin('GET', '?search=2026-0004')).json.requests.map((r) => r.student.studentId), ['2026-0004']);
    assert.equal((await admin('GET', `?term=${current._id}&status=all`)).json.requests.length, 0);
    assert.equal((await admin('GET', '/summary')).json.pending, 2);
  });

  test('approve: conditional prerequisites need an explicit yes, then every class becomes a real enrollment', async () => {
    const request = await PreEnrollment.findOne({ student: S['2026-0002']._id });
    const offeringIds = request.items.map((i) => String(i.offering));
    const seatsBefore = await Promise.all(offeringIds.map(async (id) => (await Offering.findById(id)).enrolledCount));

    const refused = await admin('POST', `/${request._id}/approve`, {});
    assert.deepEqual([refused.status, refused.json.code], [409, 'CONDITIONAL_PREREQUISITES']);
    assert.ok(refused.json.warnings.length >= 3);
    assert.equal(await Enrollment.countDocuments({ student: S['2026-0002']._id, term: next._id }), 0);

    // If a seat is lost half-way through (simulated), everything already added is taken back.
    const real = Offering.findOneAndUpdate;
    Offering.findOneAndUpdate = function patched(filter, ...rest) {
      return String(filter?._id) === offeringIds[3] ? Promise.resolve(null) : real.call(this, filter, ...rest);
    };
    let failed;
    try {
      failed = await admin('POST', `/${request._id}/approve`, { allowConditional: true });
    } finally {
      Offering.findOneAndUpdate = real;
    }
    assert.deepEqual([failed.status, failed.json.code], [409, 'OFFERING_FULL']);
    assert.match(failed.json.message, /Nothing was enrolled/);
    assert.equal(await Enrollment.countDocuments({ student: S['2026-0002']._id, term: next._id }), 0, 'rolled back');
    assert.deepEqual(await Promise.all(offeringIds.map(async (id) => (await Offering.findById(id)).enrolledCount)), seatsBefore, 'seats given back');
    assert.equal((await PreEnrollment.findById(request._id)).status, 'Pending');

    const approved = await admin('POST', `/${request._id}/approve`, { allowConditional: true });
    assert.deepEqual([approved.status, approved.json.status, approved.json.enrollments], [200, 'Approved', 6]);
    const rows = await Enrollment.find({ student: S['2026-0002']._id, term: next._id });
    assert.equal(rows.length, 6);
    assert.ok(rows.every((e) => e.status === 'Enrolled'));
    assert.deepEqual(await Promise.all(offeringIds.map(async (id) => (await Offering.findById(id)).enrolledCount)), seatsBefore.map((n) => n + 1));
    const done = await PreEnrollment.findById(request._id);
    assert.equal(String(done.decidedBy), adminId);
    assert.ok(done.decidedAt);
    assert.equal(done.enrollments.length, 6);

    const again = await admin('POST', `/${request._id}/approve`, { allowConditional: true });
    assert.deepEqual([again.status, again.json.code], [409, 'NOT_PENDING']);
    assert.equal(await Enrollment.countDocuments({ student: S['2026-0002']._id, term: next._id }), 6, 'a second approval adds nothing');

    // The student sees it everywhere.
    const state = (await portal('GET', '/pre-enrollment', '2026-0002')).json;
    assert.equal(state.history[0].status, 'Approved');
    assert.equal(state.existingUnits, 17);
    const sched = (await portal('GET', `/schedule?term=${next._id}`, '2026-0002')).json;
    assert.equal(sched.classes.length, 6);
    assert.ok((await portal('GET', '/dashboard', '2026-0002')).json.alerts.some((a) => a.code === 'PRE_ENROLLMENT_APPROVED'));
    assert.equal((await admin('GET', '/summary')).json.pending, 1);
  });

  test('approve: a class that filled up since the request was made blocks the approval, and nothing is enrolled', async () => {
    const request = await PreEnrollment.findOne({ student: S['2026-0004']._id });
    const last = await Offering.findById(request.items[request.items.length - 1].offering);
    await Offering.updateOne({ _id: last._id }, { enrolledCount: last.capacity });

    const queued = (await admin('GET', '')).json.requests.find((r) => r.id === String(request._id));
    assert.equal(queued.review.ok, false, 'the queue already shows the problem');
    assert.ok(queued.review.problems.some((p) => p.code === 'OFFERING_FULL' && p.offeringId === String(last._id)));

    const res = await admin('POST', `/${request._id}/approve`, { allowConditional: true });
    assert.deepEqual([res.status, res.json.code], [409, 'PREENROLL_INVALID']);
    assert.equal(res.json.problems[0].code, 'OFFERING_FULL');
    assert.equal(await Enrollment.countDocuments({ student: S['2026-0004']._id, term: next._id }), 0);
    assert.equal((await PreEnrollment.findById(request._id)).status, 'Pending');
  });

  test('reject: a reason is required and the student reads it; they can then try again', async () => {
    const request = await PreEnrollment.findOne({ student: S['2026-0004']._id });
    for (const bad of [undefined, '', 'no', 'x'.repeat(301), 42]) {
      assert.equal((await admin('POST', `/${request._id}/reject`, { note: bad })).status, 400, String(bad).slice(0, 10));
    }
    assert.equal((await PreEnrollment.findById(request._id)).status, 'Pending');

    const note = 'Section is full. Please choose section B for IT103.';
    assert.equal((await admin('POST', `/${request._id}/reject`, { note })).json.status, 'Rejected');
    const again = await admin('POST', `/${request._id}/reject`, { note });
    assert.deepEqual([again.status, again.json.code], [409, 'NOT_PENDING']);
    assert.equal((await admin('POST', `/${request._id}/approve`, { allowConditional: true })).status, 409, 'a rejected request cannot be approved');

    const mine = (await portal('GET', '/pre-enrollment', '2026-0004')).json;
    assert.equal(mine.history[0].status, 'Rejected');
    assert.equal(mine.history[0].note, note);
    assert.equal(mine.canSubmit, true, 'free to submit a new request');
    const alert = (await portal('GET', '/dashboard', '2026-0004')).json.alerts.find((a) => a.code === 'PRE_ENROLLMENT_REJECTED');
    assert.match(alert.message, /Section is full/);
    assert.equal((await admin('GET', '/summary')).json.pending, 0);
  });

  test('closing the term stops pre-enrollment; opening it again restores it', async () => {
    const picks = await ids(['GE107']);
    const closed = await call('PATCH', `/api/terms/${next._id}`, tokens.admin, { enrollmentOpen: false });
    assert.equal(closed.json.enrollmentOpen, false);
    const state = (await portal('GET', '/pre-enrollment', '2026-0001')).json;
    assert.equal(state.term, null);
    assert.deepEqual(state.blockers.map((b) => b.code), ['TERM_CLOSED']);
    assert.equal(state.canSubmit, false);
    assert.deepEqual((await portal('GET', '/pre-enrollment/offerings', '2026-0001')).json.offerings, []);
    const res = await portal('POST', '/pre-enrollment', '2026-0001', { offeringIds: picks });
    assert.equal(res.status, 409);
    assert.ok(res.json.problems.some((p) => p.code === 'TERM_CLOSED'));
    assert.ok(!(await portal('GET', '/dashboard', '2026-0001')).json.alerts.some((a) => a.code === 'PRE_ENROLLMENT_OPEN'));

    assert.equal((await call('PATCH', `/api/terms/${next._id}`, tokens.admin, { enrollmentOpen: 'yes' })).status, 400);
    assert.equal((await call('PATCH', `/api/terms/not-an-id`, tokens.admin, { enrollmentOpen: true })).status, 404);
    assert.equal((await call('PATCH', `/api/terms/${next._id}`, tokens.admin, { enrollmentOpen: true })).json.enrollmentOpen, true);
    assert.equal((await portal('GET', '/pre-enrollment', '2026-0001')).json.canSubmit, true);
  });

  test('database rule: a student can have only one pending request per term', async () => {
    const picks = (await ids(['GE107'])).map((offering) => ({ offering, subject: S['2026-0001']._id, units: 3 }));
    const base = { student: S['2026-0001']._id, term: next._id, items: picks, totalUnits: 3 };
    await PreEnrollment.create(base);
    await assert.rejects(PreEnrollment.create(base), { code: 11000 });
    await PreEnrollment.create({ ...base, status: 'Cancelled' }); // history is unlimited
    await PreEnrollment.deleteMany({ student: S['2026-0001']._id });
  });

  test('purging a student also removes their pre-enrollment requests', async () => {
    const { purgeStudentRecords } = require('../services/cleanup');
    assert.equal(await PreEnrollment.countDocuments({ student: S['2026-0004']._id }), 1);
    await purgeStudentRecords(S['2026-0004']._id);
    assert.equal(await PreEnrollment.countDocuments({ student: S['2026-0004']._id }), 0);
    await Hold.countDocuments();
  });
});
