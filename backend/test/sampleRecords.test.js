// Tests for sample records (classes and grades for students who have none) and the account name change.
//
//   MONGO_TEST_URI="mongodb://127.0.0.1:27017/lodgecrest_test" npm test
//
// Like the other database tests, these ERASE the database they connect to (its name must contain "test").

require('./_env'); // proofs of payment go to a temporary folder (see _env.js)
const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-not-for-production';

const URI = process.env.MONGO_TEST_URI;
const skip = URI ? false : 'set MONGO_TEST_URI to run the database tests';

const models = require('../models');
const { Student, User, Term, Subject, Offering, Enrollment, Grade } = models;
const { runSeed } = require('../seed/index');
const { findConflicts } = require('../services/schedule');
const app = require('../app');

async function resetDatabase() {
  const name = mongoose.connection.name;
  if (!/test/i.test(name)) throw new Error(`Refusing to erase database "${name}": its name must contain "test".`);
  await mongoose.connection.dropDatabase();
  await Promise.all(Object.values(models).map((M) => M.syncIndexes()));
}

describe('sample records and account name', { skip }, () => {
  let server;
  let origin;
  let adminToken;
  let studentToken;
  let template;
  let n = 100;

  const sign = (user) => jwt.sign({ id: String(user._id), role: user.role, tv: user.tokenVersion ?? 0 }, process.env.JWT_SECRET, { expiresIn: '1h' });
  async function call(method, path, token, body) {
    const res = await fetch(origin + path, {
      method,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, json: await res.json().catch(() => null) };
  }
  const admin = (method, path, body) => call(method, `/api${path}`, adminToken, body);

  // A new student shaped like a seeded one, with the given course, year and section and no records.
  async function makeStudent(over = {}) {
    n += 1;
    const base = template.toObject();
    delete base._id;
    delete base.createdAt;
    delete base.updatedAt;
    delete base.sampleRecordsAt;
    const course = over.course ?? 'BSIT';
    const program = (await models.Course.findOne({ code: course }))?._id;
    return Student.create({ ...base, studentId: `2026-${String(n).padStart(4, '0')}`, email: `new${n}@example.test`, course, program, yearLevel: '1st Year', section: 'A', academicStatus: 'Enrolled', ...over });
  }
  const enrollmentsOf = (s) => Enrollment.find({ student: s._id }).populate('offering');

  before(async () => {
    await mongoose.connect(URI);
    await resetDatabase();
    await runSeed({ log: () => {} });
    template = await Student.findOne({ studentId: '2026-0002' });
    adminToken = sign(await User.findOne({ role: 'admin' }));
    studentToken = sign(await User.findOne({ role: 'student' }));
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

  test('administrators only', async () => {
    const dummy = new mongoose.Types.ObjectId();
    const endpoints = [['POST', `/api/students/${dummy}/sample-records`], ['DELETE', `/api/students/${dummy}/sample-records`], ['GET', '/api/sample-records/pending'], ['POST', '/api/sample-records/backfill']];
    for (const [method, path] of endpoints) {
      assert.equal((await call(method, path, null, method === 'GET' ? undefined : {})).status, 401, `${method} ${path} without a token`);
      assert.equal((await call(method, path, studentToken, method === 'GET' ? undefined : {})).status, 403, `${method} ${path} as a student`);
    }
  });

  test('this term only: the standard subjects for the year and semester, no clashes, seats counted, nothing marked as sample', async () => {
    const s = await makeStudent({ yearLevel: '1st Year' });
    const r = await admin('POST', `/students/${s._id}/sample-records`, {});
    assert.equal(r.status, 201);
    assert.deepEqual([r.json.currentClasses, r.json.termsCompleted, r.json.gradesPosted], [6, 0, 0]);

    const rows = await enrollmentsOf(s);
    assert.equal(rows.length, 6);
    assert.ok(rows.every((e) => e.status === 'Enrolled'));
    const current = await Term.findOne({ isCurrent: true });
    assert.ok(rows.every((e) => String(e.term) === String(current._id)));
    const codes = (await Subject.find({ _id: { $in: rows.map((e) => e.subject) } })).map((x) => x.code).sort();
    assert.deepEqual(codes, ['GE101', 'GE104', 'IT101', 'IT102', 'NSTP1', 'PE1'], 'BSIT, 1st year, 1st semester');
    assert.equal(findConflicts(rows.map((e) => e.offering)).length, 0, 'no two classes at the same time');
    assert.ok(rows.every((e) => e.offering.section === 'A'));
    assert.equal(await Grade.countDocuments({ student: s._id }), 0);
    assert.equal((await Student.findById(s._id)).sampleRecordsAt, undefined, 'a plain default load is not "sample data"');
  });

  test('with history: earlier semesters are completed with grades, in order, and the portal shows them', async () => {
    const s = await makeStudent({ yearLevel: '3rd Year', section: 'B' });
    const r = await admin('POST', `/students/${s._id}/sample-records`, { history: true });
    assert.deepEqual([r.json.currentClasses, r.json.termsCompleted, r.json.gradesPosted], [6, 4, 24]);
    assert.ok((await Student.findById(s._id)).sampleRecordsAt, 'marked, so the admin can remove it later');

    const rows = await enrollmentsOf(s);
    assert.equal(rows.length, 30);
    assert.equal(rows.filter((e) => e.status === 'Completed').length, 24);
    const terms = (await Term.find({ _id: { $in: rows.map((e) => e.term) } }).sort({ startDate: 1 })).map((t) => t.name);
    assert.deepEqual(terms, ['2024-2025 1st Semester', '2024-2025 2nd Semester', '2025-2026 1st Semester', '2025-2026 2nd Semester', '2026-2027 1st Semester']);
    for (const t of new Set(rows.map((e) => String(e.term)))) {
      assert.equal(findConflicts(rows.filter((e) => String(e.term) === t).map((e) => e.offering)).length, 0, 'a semester never overlaps itself');
    }
    const grades = await Grade.find({ student: s._id });
    assert.ok(grades.every((g) => g.value >= 1 && g.value <= 2.75 && g.remark === 'Passed'));
    // Every seat is counted exactly once.
    for (const e of rows) assert.ok(e.offering.enrolledCount >= 1 && e.offering.enrolledCount <= e.offering.capacity);

    // The portal login for this student sees real data straight away.
    const user = await User.create({ name: 'New Student', email: `portal${s.studentId}@example.test`, password: 'unused-in-tests', role: 'student', student: s._id });
    const token = sign(user);
    const dash = (await call('GET', '/api/portal/dashboard', token)).json;
    assert.deepEqual(dash.units.earned, 68);
    assert.ok(dash.gwa >= 1 && dash.gwa <= 2.75);
    assert.deepEqual(dash.currentLoad, { subjects: 6, units: 18 });
    const sched = (await call('GET', '/api/portal/schedule', token)).json;
    assert.equal(sched.classes.length, 6);
    const grades2 = (await call('GET', '/api/portal/grades', token)).json;
    assert.equal(grades2.terms.length, 5);
    assert.equal(grades2.overall.outstandingFailures.length, 0);
  });

  test('running it again adds nothing', async () => {
    const s = await makeStudent({ yearLevel: '2nd Year' });
    await admin('POST', `/students/${s._id}/sample-records`, { history: true });
    const before = await Enrollment.countDocuments({ student: s._id });
    const again = await admin('POST', `/students/${s._id}/sample-records`, { history: true });
    assert.deepEqual([again.json.currentClasses, again.json.termsCompleted, again.json.gradesPosted], [0, 0, 0]);
    assert.ok(again.json.skipped.some((x) => /already has records/.test(x)));
    assert.equal(await Enrollment.countDocuments({ student: s._id }), before);
  });

  test('refused when the student cannot be given classes', async () => {
    const dummy = new mongoose.Types.ObjectId();
    assert.equal((await admin('POST', `/students/${dummy}/sample-records`, {})).status, 404);

    const leave = await makeStudent({ academicStatus: 'LOA' });
    assert.equal((await admin('POST', `/students/${leave._id}/sample-records`, {})).json.code, 'STUDENT_NOT_ACTIVE');
    const archived = await makeStudent({ academicStatus: 'Archived' });
    assert.equal((await admin('POST', `/students/${archived._id}/sample-records`, {})).status, 409);
    const noCourse = await makeStudent({ course: '', program: undefined });
    assert.equal((await admin('POST', `/students/${noCourse._id}/sample-records`, {})).json.code, 'NO_PROGRAM');
    const noSection = await makeStudent({ section: '' });
    assert.equal((await admin('POST', `/students/${noSection._id}/sample-records`, {})).json.code, 'NO_YEAR_LEVEL');

    await Term.updateMany({}, { isCurrent: false });
    const ok = await makeStudent();
    assert.equal((await admin('POST', `/students/${ok._id}/sample-records`, {})).json.code, 'NO_TERM');
    await Term.updateOne({ academicYear: '2026-2027', semester: '1st Semester' }, { isCurrent: true });
    for (const s of [leave, archived, noCourse, noSection, ok]) assert.equal(await Enrollment.countDocuments({ student: s._id }), 0, 'nothing was created');
  });

  test('a full class does not block it: another section is used', async () => {
    const current = await Term.findOne({ isCurrent: true });
    const ge101 = await Subject.findOne({ code: 'GE101' });
    const target = await Offering.findOne({ term: current._id, subject: ge101._id, section: 'C' });
    const section = target ?? (await Offering.create({ term: current._id, subject: ge101._id, section: 'C', professor: 'Prof. Test', capacity: 1, enrolledCount: 1, meetings: [{ day: 'Sat', start: '15:00', end: '16:00' }] }));
    await Offering.updateOne({ _id: section._id }, { capacity: 1, enrolledCount: 1 });

    const s = await makeStudent({ section: 'C' });
    const r = await admin('POST', `/students/${s._id}/sample-records`, {});
    assert.equal(r.json.currentClasses, 6);
    const ge = (await enrollmentsOf(s)).find((e) => String(e.subject) === String(ge101._id));
    assert.equal(ge.offering.section, 'C2', 'a new section opened beside the full one');
    assert.equal((await Offering.findById(section._id)).enrolledCount, 1, 'the full class was not overfilled');
  });

  test('removing sample records returns the seats and clears the mark; ordinary records are protected', async () => {
    const s = await makeStudent({ yearLevel: '2nd Year', section: 'A' });
    await admin('POST', `/students/${s._id}/sample-records`, { history: true });
    const rows = await enrollmentsOf(s);
    const before = new Map((await Offering.find({ _id: { $in: rows.map((e) => e.offering._id) } })).map((o) => [String(o._id), o.enrolledCount]));

    const res = await admin('DELETE', `/students/${s._id}/sample-records`);
    assert.equal(res.status, 200);
    assert.ok(res.json.removed >= 30);
    assert.equal(await Enrollment.countDocuments({ student: s._id }), 0);
    assert.equal(await Grade.countDocuments({ student: s._id }), 0);
    for (const [id, count] of before) assert.equal((await Offering.findById(id)).enrolledCount, count - 1, 'seat returned');
    assert.equal((await Student.findById(s._id)).sampleRecordsAt, undefined);

    assert.equal((await admin('DELETE', `/students/${s._id}/sample-records`)).json.code, 'NO_SAMPLE_RECORDS', 'nothing left to remove');
    // A student with real (not generated) records cannot be wiped this way.
    const real = await Student.findOne({ studentId: '2026-0001' });
    assert.equal((await admin('DELETE', `/students/${real._id}/sample-records`)).status, 409);
    assert.ok(await Enrollment.countDocuments({ student: real._id }) > 0);
  });

  test('backfill: finds enrolled students with no classes, fills them, and reports those it cannot', async () => {
    await Enrollment.deleteMany({ student: { $in: (await Student.find({ studentId: { $gte: '2026-0101' } })).map((x) => x._id) } });
    await Student.deleteMany({ studentId: { $gte: '2026-0101' } });
    await Offering.updateMany({}, { $set: { enrolledCount: 0 } });
    for (const e of await Enrollment.aggregate([{ $match: { status: { $ne: 'Dropped' } } }, { $group: { _id: '$offering', n: { $sum: 1 } } }])) await Offering.updateOne({ _id: e._id }, { enrolledCount: e.n });

    const fresh = await makeStudent({ yearLevel: '2nd Year' });
    const noCurriculum = await makeStudent({ course: 'BSCS', yearLevel: '3rd Year' }); // the BSCS catalog stops after first year
    await makeStudent({ academicStatus: 'Transferred' }); // not eligible
    const pending = (await admin('GET', '/sample-records/pending')).json;
    const ids = pending.students.map((x) => x.studentId);
    assert.ok(ids.includes(fresh.studentId) && ids.includes(noCurriculum.studentId));
    assert.ok(ids.includes('2026-0006'), 'a seeded student (Lim) has no classes either');
    assert.equal(ids.includes('2026-0007'), false, 'a transferred student is not eligible');
    assert.equal(pending.count, ids.length);

    const run = (await admin('POST', '/sample-records/backfill', {})).json;
    assert.equal(run.processed, pending.count);
    assert.equal(run.succeeded, run.processed);
    assert.equal(run.results.find((x) => x.studentId === fresh.studentId).currentClasses, 6);
    const partial = run.results.find((x) => x.studentId === noCurriculum.studentId);
    assert.equal(partial.termsCompleted, 2, 'BSCS lists only first-year subjects: those two semesters were filled');
    assert.ok(partial.skipped.some((x) => /no subjects listed/.test(x)), 'and the rest are reported, not invented');
    assert.ok(run.results.find((x) => x.studentId === '2026-0006').currentClasses > 0 || run.results.find((x) => x.studentId === '2026-0006').skipped.length > 0);

    const after = (await admin('GET', '/sample-records/pending')).json.students.map((x) => x.studentId);
    assert.ok(!after.includes(fresh.studentId), 'filled in');
    assert.ok(!after.includes(noCurriculum.studentId));
  });

  test('account name: change your own display name, with validation; the sign-in e-mail stays fixed', async () => {
    const me = (await call('GET', '/api/auth/me', adminToken)).json;
    const patch = (body, token = adminToken) => call('PATCH', '/api/auth/me', token, body);

    const ok = await patch({ name: "  Dr.  Ana  O'Neil-Reyes " });
    assert.equal(ok.status, 200);
    assert.equal(ok.json.name, "Dr. Ana O'Neil-Reyes", 'trimmed and single-spaced');
    assert.equal(ok.json.email, me.email);
    assert.equal((await call('GET', '/api/auth/me', adminToken)).json.name, "Dr. Ana O'Neil-Reyes");

    for (const bad of [{}, { name: '' }, { name: 'A' }, { name: 'x'.repeat(61) }, { name: '1234' }, { name: '<b>Admin</b>' }, { name: 42 }]) {
      const r = await patch(bad);
      assert.equal(r.status, 400, JSON.stringify(bad).slice(0, 30));
      assert.ok(r.json.errors?.length);
    }
    for (const locked of [{ name: 'Fine Name', email: 'someone@else.test' }, { name: 'Fine Name', role: 'student' }, { name: 'Fine Name', studentId: '2026-0001' }]) {
      const r = await patch(locked);
      assert.equal(r.status, 400);
      assert.match(r.json.message, /cannot be changed/);
    }
    assert.equal((await call('GET', '/api/auth/me', adminToken)).json.name, "Dr. Ana O'Neil-Reyes", 'a refused request changes nothing');
    assert.equal((await call('PATCH', '/api/auth/me', null, { name: 'Anon' })).status, 401);
    assert.equal((await patch({ name: 'Student Rename' }, studentToken)).status, 403, 'a student changes their name through the Registrar');
  });
});
