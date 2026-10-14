// Tests for the admin Grades page data: GET /api/grades with its term, course, section and year filters.
// Every expected number is recomputed here straight from the collections, not copied from the response.
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
const { Student, User, Term, Grade } = models;
const { runSeed } = require('../seed/index');
const { computeStanding } = require('../services/gwa');
const app = require('../app');

async function resetDatabase() {
  const name = mongoose.connection.name;
  if (!/test/i.test(name)) throw new Error(`Refusing to erase database "${name}": its name must contain "test".`);
  await mongoose.connection.dropDatabase();
  await Promise.all(Object.values(models).map((M) => M.syncIndexes()));
}

describe('admin grades list', { skip }, () => {
  let server;
  let origin;
  let adminToken;
  let studentToken;
  let term; // 2025-2026 2nd Semester: a finished term with grades for several courses

  const sign = (user) => jwt.sign({ id: String(user._id), role: user.role, tv: 0 }, process.env.JWT_SECRET, { expiresIn: '1h' });
  async function get(query = {}, token = adminToken) {
    const qs = new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined)).toString();
    const res = await fetch(`${origin}/api/grades${qs ? `?${qs}` : ''}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    return { status: res.status, json: await res.json().catch(() => null) };
  }

  // What the answer should be, worked out from the database for the same filters.
  async function expected({ course, section, yearLevel } = {}) {
    const filter = { academicStatus: { $nin: ['Archived', 'Transferred'] } };
    if (course) filter.course = course;
    if (section) filter.section = section;
    if (yearLevel) filter.yearLevel = yearLevel;
    const ids = (await Student.find(filter)).map((s) => s._id);
    const grades = await Grade.find({ term: term._id, student: { $in: ids } }).populate('subject');
    const standing = computeStanding(grades.map((g) => ({ subjectId: String(g.subject._id), units: g.subject.units, countsToGwa: g.subject.countsToGwa, value: g.value ?? null, mark: g.mark ?? null })));
    return {
      records: grades.length,
      students: new Set(grades.map((g) => String(g.student))).size,
      gwa: standing.gwa,
      passed: grades.filter((g) => g.remark === 'Passed').length,
      failed: grades.filter((g) => g.remark === 'Failed').length,
      incomplete: grades.filter((g) => g.remark === 'Incomplete').length,
    };
  }

  before(async () => {
    await mongoose.connect(URI);
    await resetDatabase();
    await runSeed({ log: () => {} });
    term = await Term.findOne({ academicYear: '2025-2026', semester: '2nd Semester' });
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
    assert.equal((await get({}, null)).status, 401);
    assert.equal((await get({}, studentToken)).status, 403);
  });

  test('with a term and no other filter: every graded student, rows and summary that agree', async () => {
    const r = (await get({ term: String(term._id) })).json;
    const want = await expected();
    assert.equal(r.term.name, '2025-2026 2nd Semester');
    assert.equal(r.rows.length, want.records);
    assert.ok(want.records >= 12, 'the seed has real grades in this semester');
    assert.deepEqual({ records: r.summary.records, students: r.summary.students, gwa: r.summary.gwa, passed: r.summary.passed, failed: r.summary.failed, incomplete: r.summary.incomplete }, want);
    assert.equal(r.truncated, false);
    // Sorted by student, then subject.
    const keys = r.rows.map((x) => `${x.student.name}|${x.subject.code}`);
    assert.deepEqual(keys, [...keys].sort((a, b) => a.split('|')[0].localeCompare(b.split('|')[0]) || a.split('|')[1].localeCompare(b.split('|')[1])));
  });

  test('choosing a course shows only that course, and the summary changes with it', async () => {
    const all = (await get({ term: String(term._id) })).json;
    const courses = [...new Set(all.rows.map((x) => x.student.course))];
    assert.ok(courses.length >= 2, 'more than one course has grades, so filtering means something');

    for (const course of courses) {
      const r = (await get({ term: String(term._id), course })).json;
      const want = await expected({ course });
      assert.ok(r.rows.length > 0 && r.rows.length < all.rows.length, `${course} is a proper subset`);
      assert.ok(r.rows.every((x) => x.student.course === course), `only ${course} rows`);
      assert.deepEqual({ records: r.summary.records, students: r.summary.students, gwa: r.summary.gwa, passed: r.summary.passed, failed: r.summary.failed }, { records: want.records, students: want.students, gwa: want.gwa, passed: want.passed, failed: want.failed });
    }
    // The GWAs differ between courses, so a stuck summary would be caught.
    const gwas = await Promise.all(courses.map(async (course) => (await get({ term: String(term._id), course })).json.summary.gwa));
    assert.ok(new Set(gwas).size > 1, 'each course has its own average');
  });

  test('choosing a section narrows it further; course + section + year combine', async () => {
    const all = (await get({ term: String(term._id) })).json;
    const sections = [...new Set(all.rows.map((x) => x.student.section))];
    for (const section of sections) {
      const r = (await get({ term: String(term._id), section })).json;
      assert.ok(r.rows.every((x) => x.student.section === section));
      assert.equal(r.summary.records, (await expected({ section })).records);
    }
    const sample = all.rows[0].student;
    const combo = (await get({ term: String(term._id), course: sample.course, section: sample.section, yearLevel: sample.yearLevel })).json;
    const want = await expected({ course: sample.course, section: sample.section, yearLevel: sample.yearLevel });
    assert.equal(combo.summary.records, want.records);
    assert.deepEqual(combo.summary.gwa, want.gwa);
    assert.ok(combo.rows.every((x) => x.student.course === sample.course && x.student.section === sample.section && x.student.yearLevel === sample.yearLevel));
  });

  test('a filter that matches nothing gives an empty, well-formed answer', async () => {
    const r = (await get({ term: String(term._id), course: 'NOSUCH' })).json;
    assert.deepEqual(r.rows, []);
    assert.deepEqual(r.summary, { students: 0, records: 0, gwa: null, passed: 0, failed: 0, incomplete: 0, dropped: 0, passRate: null });
  });

  test('the term filter works: no term means the latest graded semester, and the in-progress term is empty', async () => {
    const byDefault = (await get({})).json;
    assert.equal(byDefault.term.name, '2025-2026 2nd Semester', 'the newest semester that has grades');
    assert.ok(byDefault.rows.length > 0, 'so the page never opens empty');

    const current = await Term.findOne({ isCurrent: true });
    const inProgress = (await get({ term: String(current._id) })).json;
    assert.equal(inProgress.term.isCurrent, true);
    assert.equal(inProgress.rows.length, 0, 'nothing is graded until the semester ends');

    const first = await Term.findOne({ academicYear: '2025-2026', semester: '1st Semester' });
    const other = (await get({ term: String(first._id) })).json;
    assert.equal(other.term.name, '2025-2026 1st Semester');
    assert.ok(other.rows.length > 0);
    assert.notEqual(other.summary.records, byDefault.summary.records);
  });

  test('archived and transferred students are left out; bad filter values are a 400', async () => {
    const before = (await get({ term: String(term._id) })).json.summary.records;
    const santos = await Student.findOne({ studentId: '2026-0001' });
    const santosRows = (await get({ term: String(term._id) })).json.rows.filter((x) => x.student.studentId === '2026-0001').length;
    assert.ok(santosRows > 0);
    await Student.updateOne({ _id: santos._id }, { academicStatus: 'Archived' });
    assert.equal((await get({ term: String(term._id) })).json.summary.records, before - santosRows);
    await Student.updateOne({ _id: santos._id }, { academicStatus: 'Enrolled' });

    for (const bad of [{ course: 'bad code!' }, { section: 'Z' }, { yearLevel: '9th Year' }]) {
      const r = await get({ term: String(term._id), ...bad });
      assert.equal(r.status, 400, JSON.stringify(bad));
    }
  });

  test('a posted grade shows up at once, and the summary moves with it', async () => {
    const r1 = (await get({ term: String(term._id), course: 'BSIT' })).json;
    const row = r1.rows.find((x) => x.value !== null && x.value <= 3 && x.subject.countsToGwa);
    const grade = await Grade.findById(row.id);
    await Grade.updateOne({ _id: grade._id }, { value: 5, remark: 'Failed' });
    const r2 = (await get({ term: String(term._id), course: 'BSIT' })).json;
    assert.equal(r2.summary.failed, r1.summary.failed + 1);
    assert.equal(r2.summary.passed, r1.summary.passed - 1);
    assert.ok(r2.summary.gwa > r1.summary.gwa, 'a 5.00 raises (worsens) the average');
    assert.equal(r2.rows.find((x) => x.id === row.id).remark, 'Failed');
    await Grade.updateOne({ _id: grade._id }, { value: row.value, remark: 'Passed' });
  });
});
