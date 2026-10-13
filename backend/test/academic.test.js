// Tests for the academic data foundation: model rules, indexes, services, seed and migration.
//
//   MONGO_TEST_URI="mongodb://127.0.0.1:27017/lodgecrest_test" npm test
//
// These tests ERASE the database they connect to, so the database name must contain "test"
// (anything else is refused). Without MONGO_TEST_URI they are skipped.

const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const http = require('node:http');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-not-for-production';

const URI = process.env.MONGO_TEST_URI;
const skip = URI ? false : 'set MONGO_TEST_URI to run the database tests';

const models = require('../models');
const { Student, User, Course, Term, Subject, Offering, Enrollment, Grade, Attendance, Charge, Payment, Hold } = models;
const { computeStanding } = require('../services/gwa');
const { computeBalance } = require('../services/accounts');
const { meetingsOverlap, offeringsConflict, findConflicts } = require('../services/schedule');
const { enrollStudent, dropEnrollment } = require('../services/enrollment');
const { purgeStudentRecords } = require('../services/cleanup');
const { runSeed } = require('../seed/index');
const { migrate } = require('../utils/migrate');
const app = require('../app');

// ------------------------------------------------------------------------------------------------
// Fixtures
// ------------------------------------------------------------------------------------------------
let counter = 0;
const next = () => (counter += 1);

const makeCourse = (over = {}) => Course.create({ code: `C${next()}X`, name: 'Test Course', totalUnits: 10, ...over });
const makeTerm = (over = {}) => {
  const n = next();
  const y = 3000 + n; // far-future years can never clash with seeded terms
  return Term.create({ academicYear: `${y}-${y + 1}`, semester: '1st Semester', startDate: new Date(Date.UTC(y, 7, 1)), endDate: new Date(Date.UTC(y, 11, 1)), ...over });
};
const makeSubject = (over = {}) => Subject.create({ code: `S${next()}X`, title: 'Test Subject', units: 3, ...over });
const meeting = (day, start, end) => ({ day, start, end, room: 'R1' });
const makeOffering = async (over = {}) => {
  const term = over.term ? { _id: over.term } : await makeTerm();
  const subject = over.subject ? { _id: over.subject } : await makeSubject();
  return Offering.create({ term: term._id, subject: subject._id, section: 'A', professor: 'Prof. Test', meetings: [meeting('Mon', '08:00', '09:00')], ...over, ...(over.term ? {} : { term: term._id }), ...(over.subject ? {} : { subject: subject._id }) });
};
const makeStudent = (over = {}) =>
  Student.create({ studentId: `2099-${String(next()).padStart(4, '0')}`, firstName: 'Test', lastName: 'Student', dob: '2005-01-01', gender: 'Male', email: `t${next()}@x.com`, contactNumber: '0917', address: 'Manila', ...over });

// Assertion helpers
const expectDuplicateKey = (promise) => assert.rejects(promise, (err) => err.code === 11000);
const expectInvalid = (promise, path) =>
  assert.rejects(promise, (err) => err.name === 'ValidationError' && (path ? Boolean(err.errors[path]) : true), `expected a validation error${path ? ` on "${path}"` : ''}`);

async function resetDatabase() {
  const name = mongoose.connection.name;
  if (!/test/i.test(name)) throw new Error(`Refusing to erase database "${name}": its name must contain "test".`);
  await mongoose.connection.dropDatabase();
  await Promise.all(Object.values(models).map((M) => M.syncIndexes()));
}

before(async () => {
  if (!URI) return;
  await mongoose.connect(URI);
});
after(async () => {
  if (URI) await mongoose.disconnect();
});

// ------------------------------------------------------------------------------------------------
describe('model rules and indexes', { skip }, () => {
  before(resetDatabase);

  test('every model has the indexes the design calls for', async () => {
    const keys = async (M) => (await M.collection.indexes()).map((i) => JSON.stringify(i.key));
    assert.ok((await keys(Course)).includes('{"code":1}'));
    assert.ok((await keys(Term)).includes('{"academicYear":1,"semester":1}'));
    assert.ok((await keys(Subject)).includes('{"code":1}'));
    assert.ok((await keys(Offering)).includes('{"term":1,"subject":1,"section":1}'));
    assert.ok((await keys(Enrollment)).includes('{"student":1,"term":1,"subject":1}'));
    assert.ok((await keys(Grade)).includes('{"enrollment":1}'));
    assert.ok((await keys(Attendance)).includes('{"student":1,"offering":1,"date":1}'));
    assert.ok((await keys(Hold)).includes('{"student":1,"type":1}'));
    assert.ok((await keys(Payment)).includes('{"receiptNo":1}'));
    assert.ok((await keys(User)).includes('{"student":1}'));
  });

  test('Course: code is unique and units must be a whole number', async () => {
    const c = await makeCourse();
    await expectDuplicateKey(Course.create({ code: c.code, name: 'Dup', totalUnits: 5 }));
    await expectInvalid(makeCourse({ totalUnits: 10.5 }), 'totalUnits');
    await expectInvalid(makeCourse({ years: 0 }), 'years');
  });

  test('Term: unique per year+semester, valid years, and only ONE current term', async () => {
    const t = await makeTerm();
    await expectDuplicateKey(Term.create({ academicYear: t.academicYear, semester: t.semester, startDate: t.startDate, endDate: t.endDate }));
    await expectInvalid(makeTerm({ academicYear: '2026-2028' }), 'academicYear'); // not consecutive
    await expectInvalid(makeTerm({ academicYear: '26-27' }), 'academicYear');
    await expectInvalid(makeTerm({ endDate: new Date(Date.UTC(1999, 0, 1)) }), 'endDate');
    assert.equal((await Term.findById(t._id)).name, `${t.academicYear} ${t.semester}`);

    const a = await makeTerm({ isCurrent: true });
    await expectDuplicateKey(makeTerm({ isCurrent: true })); // a second current term is refused by the database
    await Term.updateOne({ _id: a._id }, { isCurrent: false });
    await makeTerm({ isCurrent: true }); // allowed once the first is no longer current
  });

  test('Subject: unique code, half-unit steps, no self-prerequisite', async () => {
    const s = await makeSubject();
    await expectDuplicateKey(Subject.create({ code: s.code, title: 'Dup', units: 3 }));
    await expectInvalid(makeSubject({ units: 3.3 }), 'units');
    await makeSubject({ units: 1.5 });
    await expectInvalid(makeSubject({ units: 13 }), 'units');
    assert.equal(s.countsToGwa, true);
    s.prerequisites = [s._id];
    await expectInvalid(s.save(), 'prerequisites');
  });

  test('Offering: one per term+subject+section; schedule must make sense', async () => {
    const off = await makeOffering();
    await expectDuplicateKey(Offering.create({ term: off.term, subject: off.subject, section: 'A', professor: 'X', meetings: [meeting('Tue', '08:00', '09:00')] }));
    await Offering.create({ term: off.term, subject: off.subject, section: 'B', professor: 'X', meetings: [meeting('Tue', '08:00', '09:00')] }); // another section is fine

    const base = { term: off.term, subject: (await makeSubject())._id, section: 'A', professor: 'X' };
    await expectInvalid(Offering.create({ ...base, meetings: [] }), 'meetings');
    await expectInvalid(Offering.create({ ...base, meetings: [meeting('Mon', '10:00', '09:00')] }), 'meetings'); // ends before it starts
    await expectInvalid(Offering.create({ ...base, meetings: [meeting('Mon', '25:00', '26:00')] }), 'meetings.0.start');
    await expectInvalid(Offering.create({ ...base, meetings: [meeting('Mon', '08:00', '10:00'), meeting('Mon', '09:30', '11:00')] }), 'meetings'); // overlap
    await Offering.create({ ...base, meetings: [meeting('Mon', '08:00', '09:00'), meeting('Mon', '09:00', '10:00')] }); // back-to-back is fine
    await expectInvalid(Offering.create({ ...base, subject: (await makeSubject())._id, capacity: 2, enrolledCount: 3, meetings: [meeting('Mon', '08:00', '09:00')] }), 'enrolledCount');
  });

  test('Enrollment: ONE per student per subject per term, even across sections; links are checked', async () => {
    const term = await makeTerm();
    const subject = await makeSubject();
    const secA = await makeOffering({ term: term._id, subject: subject._id, section: 'A' });
    const secB = await makeOffering({ term: term._id, subject: subject._id, section: 'B', meetings: [meeting('Tue', '08:00', '09:00')] });
    const student = await makeStudent();

    const e = await Enrollment.create({ student: student._id, offering: secA._id });
    assert.equal(String(e.term), String(term._id), 'term is copied from the offering');
    assert.equal(String(e.subject), String(subject._id), 'subject is copied from the offering');
    await expectDuplicateKey(Enrollment.create({ student: student._id, offering: secB._id })); // same subject, same term, other section

    const other = await makeStudent();
    await Enrollment.create({ student: other._id, offering: secA._id }); // a different student is fine
    await expectInvalid(Enrollment.create({ student: new mongoose.Types.ObjectId(), offering: secA._id }), 'student');
    await expectInvalid(Enrollment.create({ student: student._id, offering: new mongoose.Types.ObjectId() }), 'offering');
  });

  test('Grade: one per enrollment; numeric value XOR mark; Philippine scale; remark derived', async () => {
    const off = await makeOffering();
    const st = await makeStudent();
    const e = await Enrollment.create({ student: st._id, offering: off._id });

    await expectInvalid(Grade.create({ student: st._id, enrollment: e._id, value: 2.6 }), 'value'); // not on the scale
    await expectInvalid(Grade.create({ student: st._id, enrollment: e._id, value: 4 }), 'value'); // 4.0 does not exist
    await expectInvalid(Grade.create({ student: st._id, enrollment: e._id }), 'value'); // neither
    await expectInvalid(Grade.create({ student: st._id, enrollment: e._id, value: 1.5, mark: 'INC' }), 'value'); // both

    const g = await Grade.create({ student: st._id, enrollment: e._id, value: 3 });
    assert.equal(g.remark, 'Passed', '3.00 is the passing mark');
    assert.equal(String(g.term), String(off.term));
    await expectDuplicateKey(Grade.create({ student: st._id, enrollment: e._id, value: 1 }));

    const off2 = await makeOffering();
    const e2 = await Enrollment.create({ student: st._id, offering: off2._id });
    assert.equal((await Grade.create({ student: st._id, enrollment: e2._id, value: 5 })).remark, 'Failed');
    const e3 = await Enrollment.create({ student: st._id, offering: (await makeOffering())._id });
    assert.equal((await Grade.create({ student: st._id, enrollment: e3._id, mark: 'INC' })).remark, 'Incomplete');

    const otherStudent = await makeStudent();
    const e4 = await Enrollment.create({ student: st._id, offering: (await makeOffering())._id });
    await expectInvalid(Grade.create({ student: otherStudent._id, enrollment: e4._id, value: 1 }), 'student'); // wrong student
    await Enrollment.updateOne({ _id: e4._id }, { status: 'Dropped' });
    await expectInvalid(Grade.create({ student: st._id, enrollment: e4._id, value: 1 }), 'enrollment'); // dropped
    await expectInvalid(Grade.create({ student: st._id, enrollment: new mongoose.Types.ObjectId(), value: 1 }), 'enrollment');
  });

  test('Attendance: one record per class day, real dates only, only for enrolled students', async () => {
    const off = await makeOffering();
    const st = await makeStudent();
    await expectInvalid(Attendance.create({ student: st._id, offering: off._id, date: '2026-08-10', status: 'Present' }), 'offering'); // not enrolled yet
    await Enrollment.create({ student: st._id, offering: off._id });
    const a = await Attendance.create({ student: st._id, offering: off._id, date: '2026-08-10', status: 'Present' });
    assert.equal(String(a.term), String(off.term));
    await expectDuplicateKey(Attendance.create({ student: st._id, offering: off._id, date: '2026-08-10', status: 'Absent' }));
    await Attendance.create({ student: st._id, offering: off._id, date: '2026-08-12', status: 'Late' });
    await expectInvalid(Attendance.create({ student: st._id, offering: off._id, date: '2026-02-31', status: 'Present' }), 'date');
    await expectInvalid(Attendance.create({ student: st._id, offering: off._id, date: '2026-08-14', status: 'Sleeping' }), 'status');
  });

  test('Charge and Payment: positive amounts, at most 2 decimals, receipt numbers unique', async () => {
    const st = await makeStudent();
    await expectInvalid(Charge.create({ student: st._id, description: 'x', amount: 10.123 }), 'amount');
    await expectInvalid(Charge.create({ student: st._id, description: 'x', amount: 0 }), 'amount');
    await expectInvalid(Charge.create({ student: st._id, description: 'x', amount: -5 }), 'amount');
    await Charge.create({ student: st._id, description: 'x', amount: 10.25 });
    await expectInvalid(Payment.create({ student: st._id, amount: 5, method: 'Barter' }), 'method');
    await Payment.create({ student: st._id, amount: 5, method: 'Cash', receiptNo: 'OR-1' });
    await expectDuplicateKey(Payment.create({ student: st._id, amount: 5, method: 'Cash', receiptNo: 'OR-1' }));
    await Payment.create({ student: st._id, amount: 5, method: 'Cash' }); // receipt numbers are optional...
    await Payment.create({ student: st._id, amount: 6, method: 'Cash' }); // ...and several blanks are fine
  });

  test('Hold: only one ACTIVE hold per type per student; cleared ones are history', async () => {
    const st = await makeStudent();
    const h1 = await Hold.create({ student: st._id, type: 'Library', reason: 'Book' });
    await expectDuplicateKey(Hold.create({ student: st._id, type: 'Library', reason: 'Another book' }));
    await Hold.create({ student: st._id, type: 'Accounting', reason: 'Balance' }); // different type is fine
    h1.status = 'Cleared';
    await h1.save();
    assert.ok(h1.clearedAt, 'clearedAt is stamped automatically');
    await Hold.create({ student: st._id, type: 'Library', reason: 'A new book' }); // allowed again after clearing
    assert.equal(await Hold.countDocuments({ student: st._id, type: 'Library' }), 2);
  });
});

// ------------------------------------------------------------------------------------------------
describe('computations (no database needed)', () => {
  const id = (n) => `subject-${n}`;

  test('GWA = sum(grade x units) / sum(units)', () => {
    const r = computeStanding([
      { subjectId: id(1), units: 3, countsToGwa: true, value: 1.5 },
      { subjectId: id(2), units: 3, countsToGwa: true, value: 2 },
      { subjectId: id(3), units: 2, countsToGwa: true, value: 1 },
    ]);
    // (1.5*3 + 2*3 + 1*2) / 8 = 12.5 / 8 = 1.5625
    assert.equal(r.gwa, 1.56);
    assert.equal(r.unitsEarned, 8);
  });

  test('3.00 passes, 5.00 fails; a failed subject earns no units', () => {
    const r = computeStanding([
      { subjectId: id(1), units: 3, countsToGwa: true, value: 3 },
      { subjectId: id(2), units: 3, countsToGwa: true, value: 5 },
    ]);
    assert.equal(r.unitsEarned, 3);
    assert.deepEqual(r.outstandingFailures, [id(2)]);
    assert.equal(r.gwa, 4); // (3*3 + 5*3) / 6
  });

  test('INC, DRP and W are left out of the GWA and earn nothing', () => {
    const r = computeStanding([
      { subjectId: id(1), units: 3, countsToGwa: true, value: 2 },
      { subjectId: id(2), units: 3, countsToGwa: true, value: null, mark: 'INC' },
      { subjectId: id(3), units: 3, countsToGwa: true, value: null, mark: 'DRP' },
      { subjectId: id(4), units: 3, countsToGwa: true, value: null, mark: 'W' },
    ]);
    assert.equal(r.gwa, 2);
    assert.equal(r.unitsEarned, 3);
    assert.deepEqual(r.incomplete, [id(2)]);
  });

  test('subjects flagged countsToGwa=false (e.g. NSTP) earn units but do not move the GWA', () => {
    const r = computeStanding([
      { subjectId: id(1), units: 3, countsToGwa: true, value: 1 },
      { subjectId: id(2), units: 3, countsToGwa: false, value: 3 },
    ]);
    assert.equal(r.gwa, 1);
    assert.equal(r.unitsEarned, 6);
  });

  test('a retaken subject earns its units once, and once passed it is no longer an outstanding failure', () => {
    const r = computeStanding([
      { subjectId: id(1), units: 3, countsToGwa: true, value: 5 },
      { subjectId: id(1), units: 3, countsToGwa: true, value: 2 },
    ], { unitsRequired: 10 });
    assert.equal(r.unitsEarned, 3);
    assert.deepEqual(r.outstandingFailures, []);
    assert.equal(r.unitsRemaining, 7);
    assert.equal(r.gwa, 3.5); // both attempts count: (5*3 + 2*3) / 6
  });

  test('no graded work yet gives a null GWA, and remaining units never go negative', () => {
    assert.equal(computeStanding([]).gwa, null);
    assert.equal(computeStanding([{ subjectId: id(1), units: 9, value: 1 }], { unitsRequired: 3 }).unitsRemaining, 0);
  });

  test('balance uses whole centavos, so 0.1 + 0.2 is exactly 0.30', () => {
    const r = computeBalance([{ amount: 0.1 }, { amount: 0.2 }], []);
    assert.equal(r.totalCharges, 0.3);
    assert.equal(computeBalance([{ amount: 100 }], [{ amount: 100.01 }]).balance, -0.01); // overpaid
    assert.equal(computeBalance([{ amount: 29950 }], [{ amount: 10000 }, { amount: 8000 }]).balance, 11950);
  });

  test('schedule overlap: same day and intersecting times only; back-to-back is fine', () => {
    const a = { day: 'Mon', start: '08:00', end: '09:30' };
    assert.equal(meetingsOverlap(a, { day: 'Mon', start: '09:00', end: '10:00' }), true);
    assert.equal(meetingsOverlap(a, { day: 'Mon', start: '09:30', end: '10:30' }), false);
    assert.equal(meetingsOverlap(a, { day: 'Tue', start: '08:00', end: '09:30' }), false);
    const o1 = { meetings: [{ day: 'Mon', start: '08:00', end: '09:00' }, { day: 'Wed', start: '08:00', end: '09:00' }] };
    const o2 = { meetings: [{ day: 'Wed', start: '08:30', end: '09:30' }] };
    const o3 = { meetings: [{ day: 'Fri', start: '08:00', end: '09:00' }] };
    assert.equal(offeringsConflict(o1, o2), true);
    assert.equal(offeringsConflict(o1, o3), false);
    assert.equal(findConflicts([o1, o2, o3]).length, 1);
  });
});

// ------------------------------------------------------------------------------------------------
describe('enrollment service', { skip }, () => {
  before(resetDatabase);

  test('enrolling takes a seat; a duplicate is refused; dropping frees the seat; re-enrolling works', async () => {
    const off = await makeOffering();
    const st = await makeStudent();
    const e = await enrollStudent(st._id, off._id);
    assert.equal(e.status, 'Enrolled');
    assert.equal((await Offering.findById(off._id)).enrolledCount, 1);

    await assert.rejects(enrollStudent(st._id, off._id), { code: 'DUPLICATE_ENROLLMENT' });
    assert.equal((await Offering.findById(off._id)).enrolledCount, 1, 'a refused enrollment keeps no seat');

    await dropEnrollment(e._id);
    assert.equal((await Offering.findById(off._id)).enrolledCount, 0);
    await assert.rejects(dropEnrollment(e._id), { code: 'NOT_ACTIVE' });

    const again = await enrollStudent(st._id, off._id); // allowed again after dropping
    assert.equal(String(again._id), String(e._id), 'the dropped record is reused, keeping the unique rule intact');
    assert.equal((await Offering.findById(off._id)).enrolledCount, 1);
    assert.equal(await Enrollment.countDocuments({ student: st._id, offering: off._id }), 1);
  });

  test('the LAST SEAT cannot be taken twice, even when many students click at once', async () => {
    const off = await makeOffering({ capacity: 3 });
    const students = await Promise.all(Array.from({ length: 12 }, () => makeStudent()));
    const results = await Promise.allSettled(students.map((s) => enrollStudent(s._id, off._id)));

    const ok = results.filter((r) => r.status === 'fulfilled').length;
    const full = results.filter((r) => r.status === 'rejected' && r.reason.code === 'OFFERING_FULL').length;
    assert.equal(ok, 3, 'exactly 3 seats exist');
    assert.equal(full, 9);
    assert.equal((await Offering.findById(off._id)).enrolledCount, 3);
    assert.equal(await Enrollment.countDocuments({ offering: off._id }), 3);
  });

  test('prerequisites must be passed first (3.00 passes, 5.00 does not)', async () => {
    const prereq = await makeSubject();
    const subject = await makeSubject({ prerequisites: [prereq._id] });
    const st = await makeStudent();
    const prereqOff = await makeOffering({ subject: prereq._id });
    const target = await makeOffering({ subject: subject._id });

    await assert.rejects(enrollStudent(st._id, target._id), { code: 'PREREQUISITE_NOT_MET' });
    const e = await Enrollment.create({ student: st._id, offering: prereqOff._id, status: 'Completed' });
    await Grade.create({ student: st._id, enrollment: e._id, value: 5 });
    await assert.rejects(enrollStudent(st._id, target._id), { code: 'PREREQUISITE_NOT_MET' }, 'a failed prerequisite does not count');
    await Grade.updateOne({ enrollment: e._id }, { value: 3 });
    await enrollStudent(st._id, target._id); // passes now
    await assert.rejects(enrollStudent((await makeStudent())._id, target._id), { code: 'PREREQUISITE_NOT_MET' });
    await enrollStudent((await makeStudent())._id, target._id, { skipPrerequisites: true }); // an admin override
  });

  test('a clash with a class the student already takes is refused (and no seat is kept)', async () => {
    const term = await makeTerm();
    const a = await makeOffering({ term: term._id, meetings: [meeting('Mon', '08:00', '09:30')] });
    const clash = await makeOffering({ term: term._id, meetings: [meeting('Mon', '09:00', '10:00')] });
    const fine = await makeOffering({ term: term._id, meetings: [meeting('Mon', '09:30', '10:30')] });
    const st = await makeStudent();
    await enrollStudent(st._id, a._id);
    await assert.rejects(enrollStudent(st._id, clash._id), { code: 'SCHEDULE_CONFLICT' });
    assert.equal((await Offering.findById(clash._id)).enrolledCount, 0);
    await enrollStudent(st._id, fine._id);
  });

  test('closed classes and students who are not actively studying are refused', async () => {
    const closed = await makeOffering({ status: 'Closed' });
    const st = await makeStudent();
    await assert.rejects(enrollStudent(st._id, closed._id), { code: 'OFFERING_CLOSED' });

    const open = await makeOffering();
    for (const academicStatus of ['LOA', 'Transferred', 'Graduated', 'Archived']) {
      const s = await makeStudent({ academicStatus });
      await assert.rejects(enrollStudent(s._id, open._id), { code: 'STUDENT_NOT_ACTIVE' }, academicStatus);
    }
    await assert.rejects(enrollStudent(new mongoose.Types.ObjectId(), open._id), { code: 'STUDENT_NOT_FOUND' });
    await assert.rejects(enrollStudent(st._id, new mongoose.Types.ObjectId()), { code: 'OFFERING_NOT_FOUND' });
  });

  test('purging a student removes every academic record and returns their seats', async () => {
    const off = await makeOffering({ capacity: 5 });
    const st = await makeStudent();
    const e = await enrollStudent(st._id, off._id);
    await Grade.create({ student: st._id, enrollment: e._id, value: 1.5 });
    await Attendance.create({ student: st._id, offering: off._id, date: '2026-09-01', status: 'Present' });
    await Charge.create({ student: st._id, description: 'Tuition', amount: 100 });
    await Payment.create({ student: st._id, amount: 50, method: 'Cash' });
    await Hold.create({ student: st._id, type: 'Library', reason: 'Book' });
    const bystander = await makeStudent();
    await enrollStudent(bystander._id, off._id);
    assert.equal((await Offering.findById(off._id)).enrolledCount, 2);

    const removed = await purgeStudentRecords(st._id);
    assert.equal(removed, 6);
    for (const M of [Grade, Attendance, Charge, Payment, Hold, Enrollment]) assert.equal(await M.countDocuments({ student: st._id }), 0, M.modelName);
    assert.equal((await Offering.findById(off._id)).enrolledCount, 1, 'only the purged student\'s seat was returned');
    assert.equal(await Enrollment.countDocuments({ student: bystander._id }), 1, 'other students are untouched');
  });
});

// ------------------------------------------------------------------------------------------------
describe('seed data integrity', { skip }, () => {
  let ids; // studentNumber -> student document
  before(async () => {
    await resetDatabase();
    await runSeed({ log: () => {} });
    ids = Object.fromEntries((await Student.find()).map((s) => [s.studentId, s]));
  });

  test('the expected amount of data exists', async () => {
    const counts = Object.fromEntries(await Promise.all(Object.entries(models).map(async ([name, M]) => [name, await M.countDocuments()])));
    assert.equal(counts.Student, 8);
    assert.equal(counts.User, 2);
    assert.equal(counts.Course, 6);
    assert.equal(counts.Term, 10);
    assert.ok(counts.Subject >= 50);
    for (const name of ['Offering', 'Enrollment', 'Grade', 'Attendance', 'Charge', 'Payment']) assert.ok(counts[name] > 20, `${name} has data`);
    assert.equal(counts.Hold, 3);
    assert.equal(counts.PreEnrollment, 2);
  });

  test('exactly one current term, and one term open for pre-enrollment', async () => {
    const current = await Term.find({ isCurrent: true });
    assert.equal(current.length, 1);
    assert.equal(current[0].name, '2026-2027 1st Semester');
    const open = await Term.find({ enrollmentOpen: true });
    assert.deepEqual(open.map((t) => t.name), ['2026-2027 2nd Semester']);
  });

  test('every link points at a record that exists (no orphans)', async () => {
    const links = [
      [Student, 'program', Course], [User, 'student', Student],
      [Offering, 'term', Term], [Offering, 'subject', Subject],
      [Enrollment, 'student', Student], [Enrollment, 'offering', Offering], [Enrollment, 'term', Term], [Enrollment, 'subject', Subject],
      [Grade, 'student', Student], [Grade, 'enrollment', Enrollment], [Grade, 'term', Term], [Grade, 'subject', Subject],
      [Attendance, 'student', Student], [Attendance, 'offering', Offering], [Attendance, 'term', Term],
      [Charge, 'student', Student], [Charge, 'term', Term], [Payment, 'student', Student], [Payment, 'term', Term], [Hold, 'student', Student],
    ];
    for (const [Source, field, Target] of links) {
      const referenced = (await Source.distinct(field)).filter(Boolean);
      const found = await Target.countDocuments({ _id: { $in: referenced } });
      assert.equal(found, referenced.length, `${Source.modelName}.${field} -> ${Target.modelName}`);
    }
    const prereqIds = (await Subject.distinct('prerequisites')).filter(Boolean);
    assert.equal(await Subject.countDocuments({ _id: { $in: prereqIds } }), prereqIds.length, 'Subject.prerequisites');
    const curriculumCourses = await Subject.distinct('curriculum.course');
    assert.equal(await Course.countDocuments({ _id: { $in: curriculumCourses } }), curriculumCourses.length, 'Subject.curriculum.course');
  });

  test('every student is linked to the Course whose code they carry', async () => {
    for (const s of Object.values(ids)) {
      if (!s.course) { assert.equal(s.program, undefined); continue; }
      const course = await Course.findById(s.program);
      assert.equal(course.code, s.course, `${s.studentId}`);
    }
  });

  test('seat counts are exact and no class is over capacity', async () => {
    for (const o of await Offering.find()) {
      const seats = await Enrollment.countDocuments({ offering: o._id, status: { $ne: 'Dropped' } });
      assert.equal(o.enrolledCount, seats, `offering ${o._id}`);
      assert.ok(o.enrolledCount <= o.capacity);
    }
  });

  test('no student has two classes at the same time', async () => {
    for (const s of Object.values(ids)) {
      const terms = await Enrollment.distinct('term', { student: s._id });
      for (const term of terms) {
        const enrolled = await Enrollment.find({ student: s._id, term, status: { $ne: 'Dropped' } }).select('offering');
        const offerings = await Offering.find({ _id: { $in: enrolled.map((e) => e.offering) } });
        assert.deepEqual(findConflicts(offerings).length, 0, `${s.studentId} has a clash`);
      }
    }
  });

  test('finished classes have exactly one grade; classes in progress have none', async () => {
    for (const e of await Enrollment.find()) {
      const n = await Grade.countDocuments({ enrollment: e._id });
      assert.equal(n, e.status === 'Completed' ? 1 : 0, `enrollment ${e._id} (${e.status})`);
    }
  });

  test('subjects with prerequisites were only taken after passing them', async () => {
    const subjects = new Map((await Subject.find()).map((s) => [String(s._id), s]));
    const terms = new Map((await Term.find()).map((t) => [String(t._id), t]));
    for (const e of await Enrollment.find()) {
      const subject = subjects.get(String(e.subject));
      for (const pre of subject.prerequisites) {
        const grade = await Grade.findOne({ student: e.student, subject: pre, value: { $lte: 3 } });
        assert.ok(grade, `prerequisite of ${subject.code} not passed`);
        assert.ok(terms.get(String(grade.term)).startDate < terms.get(String(e.term)).startDate, `${subject.code} taken before its prerequisite`);
      }
    }
  });

  test('a graduate has earned exactly the units the program requires', async () => {
    const garcia = ids['2026-0005'];
    const course = await Course.findById(garcia.program);
    const rows = await standingRows(garcia._id);
    const standing = computeStanding(rows, { unitsRequired: course.totalUnits });
    assert.equal(standing.unitsEarned, 131);
    assert.equal(standing.unitsRemaining, 0);
    assert.ok(standing.gwa >= 1 && standing.gwa <= 2.5, `plausible GWA, got ${standing.gwa}`);
  });

  test('sample standings: an incomplete, a failed subject', async () => {
    const santos = computeStanding(await standingRows(ids['2026-0001']._id));
    assert.equal(santos.incomplete.length, 1, 'Santos has one incomplete (IT104)');
    assert.equal(santos.unitsEarned, 31); // 17 + (17 - the 3 incomplete units)
    const cruz = computeStanding(await standingRows(ids['2026-0003']._id));
    assert.equal(cruz.outstandingFailures.length, 1, 'Cruz failed BUS102');
    assert.equal(cruz.unitsEarned, 59);
  });

  test('statements of account match the story', async () => {
    const balanceOf = async (n) => {
      const [charges, payments] = await Promise.all([Charge.find({ student: ids[n]._id }), Payment.find({ student: ids[n]._id })]);
      return computeBalance(charges, payments).balance;
    };
    assert.equal(await balanceOf('2026-0001'), 11950); // Santos: 29,950 charged, 18,000 paid
    assert.equal(await balanceOf('2026-0002'), 0); // Reyes: paid in full
    assert.equal(await balanceOf('2026-0003'), 15700); // Cruz: 20,700 charged, 5,000 paid
    assert.equal(await balanceOf('2026-0004'), 14975); // Dela Cruz: about half paid
    assert.equal(await balanceOf('2026-0005'), 0); // Garcia, graduated: all settled
    assert.equal(await balanceOf('2026-0007'), 0);
  });

  test('holds: Santos (library) and Cruz (accounting, plus a cleared one) only', async () => {
    assert.equal(await Hold.countDocuments({ student: ids['2026-0001']._id, status: 'Active', type: 'Library' }), 1);
    assert.equal(await Hold.countDocuments({ student: ids['2026-0003']._id, status: 'Active', type: 'Accounting' }), 1);
    assert.equal(await Hold.countDocuments({ student: ids['2026-0003']._id, status: 'Cleared' }), 1);
    assert.equal(await Hold.countDocuments({ student: ids['2026-0002']._id }), 0);
  });

  test('attendance only covers the current term and ends no later than today', async () => {
    const current = await Term.findOne({ isCurrent: true });
    assert.equal(await Attendance.countDocuments({ term: { $ne: current._id } }), 0);
    const today = new Date().toISOString().slice(0, 10);
    assert.equal(await Attendance.countDocuments({ date: { $gt: today } }), 0);
  });

  test('PE and NSTP carry units but are left out of the GWA; every other subject counts', async () => {
    for (const subject of await Subject.find()) {
      const excluded = /^(PE|NSTP)\d/.test(subject.code);
      assert.equal(subject.countsToGwa, !excluded, subject.code);
      if (excluded) assert.ok(subject.units > 0, `${subject.code} still carries units`);
    }
  });

  test('the demo logins are linked to the right student', async () => {
    const login = await User.findOne({ role: 'student' });
    assert.equal(String(login.student), String(ids['2026-0001']._id));
    assert.equal(await User.countDocuments({ role: 'admin' }), 1);
  });
});

// One row per graded enrollment, in the shape computeStanding() expects.
async function standingRows(studentId) {
  const grades = await Grade.find({ student: studentId });
  const subjects = new Map((await Subject.find({ _id: { $in: grades.map((g) => g.subject) } })).map((s) => [String(s._id), s]));
  return grades.map((g) => {
    const s = subjects.get(String(g.subject));
    return { subjectId: g.subject, units: s.units, countsToGwa: s.countsToGwa, value: g.value ?? null, mark: g.mark };
  });
}

// ------------------------------------------------------------------------------------------------
describe('admin records API', { skip }, () => {
  let server;
  let base;
  let adminToken;
  let studentToken;
  let S; // student number -> student document
  let current; // the current term

  const sign = (user) => jwt.sign({ id: String(user._id), role: user.role, tv: 0 }, process.env.JWT_SECRET, { expiresIn: '1h' });
  async function call(method, path, { token = adminToken, body } = {}) {
    const res = await fetch(base + path, {
      method,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, json: await res.json().catch(() => null) };
  }
  const seatsOf = async (offeringId) => (await Offering.findById(offeringId)).enrolledCount;
  const offeringFor = async (code, section = 'A') => {
    const { json } = await call('GET', `/offerings?term=${current._id}&search=${code}`);
    return json.find((o) => o.subject.code === code && o.section === section);
  };

  before(async () => {
    await resetDatabase();
    await runSeed({ log: () => {} });
    S = Object.fromEntries((await Student.find()).map((s) => [s.studentId, s]));
    current = await Term.findOne({ isCurrent: true });
    adminToken = sign(await User.findOne({ role: 'admin' }));
    studentToken = sign(await User.findOne({ role: 'student' }));
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${server.address().port}/api`;
  });
  after(async () => {
    if (!server) return;
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
  });

  test('only admins get in: no token is 401, a student token is 403, on every endpoint', async () => {
    const id = S['2026-0001']._id;
    const dummy = new mongoose.Types.ObjectId();
    const endpoints = [
      ['GET', '/terms'], ['GET', '/offerings'],
      ['GET', `/students/${id}/academic-summary`], ['GET', `/students/${id}/enrollments`], ['GET', `/students/${id}/grades`],
      ['POST', `/students/${id}/enrollments`], ['POST', `/enrollments/${dummy}/drop`],
      ['PUT', `/enrollments/${dummy}/grade`], ['DELETE', `/enrollments/${dummy}/grade`],
      ['GET', `/students/${id}/attendance`], ['PUT', `/students/${id}/attendance`], ['DELETE', `/attendance/${dummy}`],
      ['GET', `/students/${id}/finance`], ['POST', `/students/${id}/charges`], ['DELETE', `/charges/${dummy}`],
      ['POST', `/students/${id}/payments`], ['DELETE', `/payments/${dummy}`],
      ['POST', `/students/${id}/holds`], ['POST', `/holds/${dummy}/clear`],
    ];
    for (const [method, path] of endpoints) {
      assert.equal((await call(method, path, { token: null, body: method === 'GET' ? undefined : {} })).status, 401, `${method} ${path} without a token`);
      assert.equal((await call(method, path, { token: studentToken, body: method === 'GET' ? undefined : {} })).status, 403, `${method} ${path} as a student`);
    }
  });

  test('catalog: terms newest first, offerings searchable with seats left', async () => {
    const terms = (await call('GET', '/terms')).json;
    assert.equal(terms.length, 10);
    assert.equal(terms[0].name, '2026-2027 2nd Semester');
    assert.equal(terms.filter((t) => t.isCurrent).length, 1);
    const found = (await call('GET', `/offerings?term=${current._id}&search=it201`)).json;
    assert.ok(found.length >= 1 && found.every((o) => /IT201|IT201/i.test(o.subject.code)));
    assert.equal(typeof found[0].seatsLeft, 'number');
    assert.equal(found[0].seatsLeft, found[0].capacity - found[0].enrolledCount);
    assert.deepEqual((await call('GET', '/offerings?term=bad')).status, 200, 'a bad term falls back to the current one');
  });

  test('academic summary: program, standing, current load, holds and balance', async () => {
    const g = (await call('GET', `/students/${S['2026-0005']._id}/academic-summary`)).json;
    assert.equal(g.program.code, 'BSIT');
    assert.equal(g.standing.unitsEarned, 131);
    assert.equal(g.standing.unitsRequired, 131);
    assert.equal(g.standing.unitsRemaining, 0);
    assert.equal(g.currentLoad.subjects, 0, 'a graduate has no current classes');

    const s = (await call('GET', `/students/${S['2026-0001']._id}/academic-summary`)).json;
    assert.equal(s.currentTerm.name, '2026-2027 1st Semester');
    assert.equal(s.currentLoad.subjects, 6);
    assert.equal(s.currentLoad.units, 17);
    assert.equal(s.activeHolds, 1);
    assert.equal(s.balance, 11950);
    assert.equal(s.standing.incomplete.length, 1);
    assert.equal(s.standing.incomplete[0].code, 'IT104');

    assert.equal((await call('GET', `/students/${new mongoose.Types.ObjectId()}/academic-summary`)).status, 404);
    assert.equal((await call('GET', '/students/not-an-id/academic-summary')).status, 404);
  });

  test('enrollment history groups classes by term, newest first, with schedule and grade', async () => {
    const { terms } = (await call('GET', `/students/${S['2026-0001']._id}/enrollments`)).json;
    assert.equal(terms.length, 3);
    assert.equal(terms[0].term.name, '2026-2027 1st Semester');
    assert.equal(terms[0].units, 17);
    const row = terms[0].enrollments.find((r) => r.subject.code === 'IT201');
    assert.equal(row.status, 'Enrolled');
    assert.equal(row.grade, null);
    assert.ok(row.offering.meetings.length >= 1 && row.offering.professor);
    assert.ok(terms[2].enrollments.every((r) => r.status === 'Completed' && r.grade));
  });

  test('grades: each term has its own standing and the overall one matches the maths', async () => {
    const data = (await call('GET', `/students/${S['2026-0003']._id}/grades`)).json;
    assert.equal(data.terms.length, 5);
    assert.equal(data.overall.unitsEarned, 59);
    assert.equal(data.overall.outstandingFailures.length, 1);
    assert.equal(data.overall.outstandingFailures[0].code, 'BUS102');
    assert.equal(data.overall.unitsRequired, 150);
    const inProgress = data.terms[0];
    assert.equal(inProgress.standing.gwa, null, 'no grades yet this term');
    for (const t of data.terms.slice(1)) assert.ok(t.standing.gwa >= 1);
    // the cumulative GWA equals the units-weighted average of every graded, GWA-counting row
    const graded = data.terms.flatMap((t) => t.rows).filter((r) => r.grade && r.grade.value !== null && r.subject.countsToGwa);
    const expected = graded.reduce((a, r) => a + r.grade.value * r.subject.units, 0) / graded.reduce((a, r) => a + r.subject.units, 0);
    assert.equal(data.overall.gwa, Math.round(expected * 100) / 100);
  });

  test('enrolling: success, duplicate, prerequisite (with override), clash, full class, inactive student', async () => {
    const lim = S['2026-0006']._id;
    const ge103 = await offeringFor('GE103');
    const ok = await call('POST', `/students/${lim}/enrollments`, { body: { offeringId: ge103.id } });
    assert.equal(ok.status, 201);
    assert.equal(await seatsOf(ge103.id), ge103.enrolledCount + 1);

    const dup = await call('POST', `/students/${lim}/enrollments`, { body: { offeringId: ge103.id } });
    assert.deepEqual([dup.status, dup.json.code], [409, 'DUPLICATE_ENROLLMENT']);

    const it201 = await offeringFor('IT201');
    const noPrereq = await call('POST', `/students/${lim}/enrollments`, { body: { offeringId: it201.id } });
    assert.deepEqual([noPrereq.status, noPrereq.json.code], [409, 'PREREQUISITE_NOT_MET']);
    assert.equal(await seatsOf(it201.id), it201.enrolledCount, 'a refusal keeps no seat');
    const override = await call('POST', `/students/${lim}/enrollments`, { body: { offeringId: it201.id, skipPrerequisites: true } });
    assert.equal(override.status, 201, 'an admin can override a prerequisite');

    // a different class at exactly the same time as GE103 is refused
    const sameTime = await Offering.create({ term: current._id, subject: (await Subject.findOne({ code: 'IT205' }))._id, section: 'Z', professor: 'Prof. X', meetings: ge103.meetings });
    const clash = await call('POST', `/students/${lim}/enrollments`, { body: { offeringId: String(sameTime._id) } });
    assert.deepEqual([clash.status, clash.json.code], [409, 'SCHEDULE_CONFLICT']);

    // a one-seat class: the first student gets it, the second is told it is full
    const tiny = await Offering.create({ term: current._id, subject: (await Subject.findOne({ code: 'IT305' }))._id, section: 'Z', professor: 'Prof. X', capacity: 1, meetings: [{ day: 'Sat', start: '14:00', end: '15:00' }] });
    assert.equal((await call('POST', `/students/${lim}/enrollments`, { body: { offeringId: String(tiny._id) } })).status, 201);
    const full = await call('POST', `/students/${S['2026-0002']._id}/enrollments`, { body: { offeringId: String(tiny._id), skipPrerequisites: true } });
    assert.deepEqual([full.status, full.json.code], [409, 'OFFERING_FULL']);

    const transferred = await call('POST', `/students/${S['2026-0007']._id}/enrollments`, { body: { offeringId: ge103.id } });
    assert.deepEqual([transferred.status, transferred.json.code], [409, 'STUDENT_NOT_ACTIVE']);
    assert.equal((await call('POST', `/students/${lim}/enrollments`, { body: {} })).status, 400);
  });

  test('dropping frees the seat, and only a current class can be dropped', async () => {
    const lim = S['2026-0006']._id;
    const e = await Enrollment.findOne({ student: lim, status: 'Enrolled' }).populate('subject');
    const before = await seatsOf(e.offering);
    assert.equal((await call('POST', `/enrollments/${e._id}/drop`)).status, 200);
    assert.equal(await seatsOf(e.offering), before - 1);
    const again = await call('POST', `/enrollments/${e._id}/drop`);
    assert.deepEqual([again.status, again.json.code], [409, 'NOT_ACTIVE']);
    assert.equal((await call('POST', `/enrollments/${new mongoose.Types.ObjectId()}/drop`)).status, 404);
  });

  test('grading: completes the class, can be corrected, and rejects bad input', async () => {
    const lim = S['2026-0006']._id;
    const e = await Enrollment.findOne({ student: lim, status: 'Enrolled' });

    const bad = await call('PUT', `/enrollments/${e._id}/grade`, { body: { value: 2.6 } });
    assert.equal(bad.status, 400, '2.60 is not on the scale');
    assert.equal((await call('PUT', `/enrollments/${e._id}/grade`, { body: { value: 1.5, mark: 'INC' } })).status, 400, 'both');
    assert.equal((await call('PUT', `/enrollments/${e._id}/grade`, { body: {} })).status, 400, 'neither');
    assert.equal((await call('PUT', `/enrollments/${e._id}/grade`, { body: { value: '1.5' } })).status, 400, 'text is not a number');
    assert.equal((await Enrollment.findById(e._id)).status, 'Enrolled', 'a refused grade changes nothing');

    const first = await call('PUT', `/enrollments/${e._id}/grade`, { body: { value: 1.75 } });
    assert.deepEqual([first.status, first.json.remark, first.json.enrollmentStatus], [200, 'Passed', 'Completed']);
    const fixed = await call('PUT', `/enrollments/${e._id}/grade`, { body: { value: 5 } });
    assert.deepEqual([fixed.json.remark, fixed.json.value], ['Failed', 5]);
    assert.equal(await Grade.countDocuments({ enrollment: e._id }), 1, 'correcting a grade does not add a second one');
    const inc = await call('PUT', `/enrollments/${e._id}/grade`, { body: { mark: 'INC' } });
    assert.deepEqual([inc.json.remark, inc.json.value], ['Incomplete', null]);
    assert.equal((await call('PUT', `/enrollments/${e._id}/grade`, { body: { mark: 'DRP' } })).status, 409, 'DRP only while the class is in progress');

    assert.equal((await call('DELETE', `/enrollments/${e._id}/grade`)).status, 200);
    assert.equal((await Enrollment.findById(e._id)).status, 'Enrolled', 'removing the grade reopens the class');
    assert.equal((await call('DELETE', `/enrollments/${e._id}/grade`)).status, 404);
  });

  test('a DRP or W mark drops the class and frees the seat; it cannot then be edited or deleted', async () => {
    const lim = S['2026-0006']._id;
    const e = await Enrollment.findOne({ student: lim, status: 'Enrolled' });
    const before = await seatsOf(e.offering);
    const drp = await call('PUT', `/enrollments/${e._id}/grade`, { body: { mark: 'DRP' } });
    assert.deepEqual([drp.status, drp.json.remark, drp.json.enrollmentStatus], [200, 'Dropped', 'Dropped']);
    assert.equal(await seatsOf(e.offering), before - 1);
    assert.equal((await call('PUT', `/enrollments/${e._id}/grade`, { body: { value: 1 } })).status, 409);
    assert.equal((await call('DELETE', `/enrollments/${e._id}/grade`)).status, 409);
  });

  test('attendance: one record per class day (re-sending updates it), checked against enrollment', async () => {
    const santos = S['2026-0001']._id;
    const e = await Enrollment.findOne({ student: santos, term: current._id, status: 'Enrolled' });
    const url = `/students/${santos}/attendance`;
    const before = (await call('GET', url)).json;

    const created = await call('PUT', url, { body: { offeringId: String(e.offering), date: '2026-10-31', status: 'Present' } });
    assert.equal(created.status, 201);
    const updated = await call('PUT', url, { body: { offeringId: String(e.offering), date: '2026-10-31', status: 'Absent', remarks: 'Sick' } });
    assert.deepEqual([updated.status, updated.json.id === created.json.id], [200, true]);
    assert.equal(await Attendance.countDocuments({ student: santos, offering: e.offering, date: '2026-10-31' }), 1);

    assert.equal((await call('PUT', url, { body: { offeringId: String(e.offering), date: '2026-02-31', status: 'Present' } })).status, 400, 'not a real date');
    assert.equal((await call('PUT', url, { body: { offeringId: String(e.offering), date: '2026-10-30', status: 'Napping' } })).status, 400, 'unknown status');
    const taken = new Set((await Enrollment.find({ student: santos, term: current._id })).map((x) => String(x.offering)));
    const stranger = (await Offering.find({ term: current._id })).find((o) => !taken.has(String(o._id))); // a class Santos does not take
    assert.ok(stranger, 'the seed offers classes beyond Santos\'s own');
    assert.equal((await call('PUT', url, { body: { offeringId: String(stranger._id), date: '2026-10-30', status: 'Present' } })).status, 400, 'not enrolled there');

    const after = (await call('GET', url)).json;
    assert.equal(after.totals.total, before.totals.total + 1);
    assert.equal(after.totals.Absent, before.totals.Absent + 1);
    assert.equal(after.records[0].date, '2026-10-31', 'newest first');
    assert.equal(after.byClass.reduce((n, c) => n + c.total, 0), after.totals.total);
    for (const c of after.byClass) assert.equal(c.rate, Math.round((c.Present / c.total) * 100));

    assert.equal((await call('DELETE', `/attendance/${created.json.id}`)).status, 200);
    assert.equal((await call('DELETE', `/attendance/${created.json.id}`)).status, 404);
    assert.equal((await call('GET', url)).json.totals.total, before.totals.total);
    const past = (await call('GET', `${url}?term=${S['2026-0001'] && (await Term.findOne({ academicYear: '2025-2026', semester: '1st Semester' }))._id}`)).json;
    assert.equal(past.totals.total, 0, 'seeded attendance exists only for the current term');
  });

  test('accounts: charges and payments move the balance; bad money and duplicate receipts are refused', async () => {
    const santos = S['2026-0001']._id;
    const url = `/students/${santos}/finance`;
    assert.equal((await call('GET', url)).json.balance, 11950);

    const charge = await call('POST', `/students/${santos}/charges`, { body: { category: 'Other', description: 'ID replacement', amount: 150.5, termId: String(current._id) } });
    assert.equal(charge.status, 201);
    assert.equal((await call('GET', url)).json.balance, 12100.5);
    assert.equal((await call('POST', `/students/${santos}/charges`, { body: { description: 'x', amount: 10.123 } })).status, 400);
    assert.equal((await call('POST', `/students/${santos}/charges`, { body: { description: 'x', amount: 0 } })).status, 400);

    const pay = await call('POST', `/students/${santos}/payments`, { body: { amount: 12100.5, method: 'Cash', receiptNo: 'OR-TEST-1' } });
    assert.equal(pay.status, 201);
    assert.equal((await call('GET', url)).json.balance, 0);
    const dup = await call('POST', `/students/${santos}/payments`, { body: { amount: 1, method: 'Cash', receiptNo: 'OR-TEST-1' } });
    assert.deepEqual([dup.status, /receipt/i.test(dup.json.message)], [409, true]);
    assert.equal((await call('POST', `/students/${santos}/payments`, { body: { amount: 5, method: 'Barter' } })).status, 400);

    const list = (await call('GET', url)).json;
    assert.ok(list.charges.some((c) => c.description === 'ID replacement' && c.term.name === '2026-2027 1st Semester'));
    assert.equal((await call('DELETE', `/payments/${pay.json.id}`)).status, 200);
    assert.equal((await call('DELETE', `/charges/${charge.json.id}`)).status, 200);
    assert.equal((await call('GET', url)).json.balance, 11950, 'back where it started');
    assert.equal((await call('DELETE', `/charges/${charge.json.id}`)).status, 404);
  });

  test('holds: one active per type, clearing keeps history, a cleared hold cannot be cleared twice', async () => {
    const santos = S['2026-0001']._id;
    const dup = await call('POST', `/students/${santos}/holds`, { body: { type: 'Library', reason: 'Another' } });
    assert.deepEqual([dup.status, /Library/.test(dup.json.message)], [409, true], 'Santos already has an active Library hold');
    assert.equal((await call('POST', `/students/${santos}/holds`, { body: { type: 'Library' } })).status, 400, 'a reason is required');

    const placed = await call('POST', `/students/${santos}/holds`, { body: { type: 'Guidance', reason: 'Counselling pending' } });
    assert.equal(placed.status, 201);
    assert.equal((await call('GET', `/students/${santos}/academic-summary`)).json.activeHolds, 2);
    const cleared = await call('POST', `/holds/${placed.json.id}/clear`);
    assert.deepEqual([cleared.status, cleared.json.status], [200, 'Cleared']);
    assert.equal((await call('POST', `/holds/${placed.json.id}/clear`)).status, 409);
    const holds = (await call('GET', `/students/${santos}/finance`)).json.holds;
    assert.equal(holds[0].status, 'Active', 'active holds are listed first');
    assert.ok(holds.some((h) => h.type === 'Guidance' && h.status === 'Cleared'));
    assert.equal((await call('POST', `/students/${santos}/holds`, { body: { type: 'Guidance', reason: 'A second case' } })).status, 201, 'allowed again once cleared');
  });

  test('an archived student\'s records are read-only until restored', async () => {
    const cruz = S['2026-0003']._id;
    assert.equal((await call('DELETE', `/students/${cruz}`)).status, 200); // archive
    for (const [method, path, body] of [
      ['POST', `/students/${cruz}/charges`, { description: 'x', amount: 10 }],
      ['POST', `/students/${cruz}/payments`, { amount: 10, method: 'Cash' }],
      ['POST', `/students/${cruz}/holds`, { type: 'Other', reason: 'x' }],
      ['POST', `/students/${cruz}/enrollments`, { offeringId: String(new mongoose.Types.ObjectId()) }],
    ]) {
      assert.equal((await call(method, path, { body })).status, 409, `${method} ${path}`);
    }
    const e = await Enrollment.findOne({ student: cruz, status: 'Enrolled' });
    assert.equal((await call('PUT', `/enrollments/${e._id}/grade`, { body: { value: 2 } })).status, 409);
    assert.equal((await call('GET', `/students/${cruz}/finance`)).status, 200, 'reading is still allowed');
    assert.equal((await call('POST', `/students/${cruz}/restore`)).status, 200);
    assert.equal((await call('POST', `/students/${cruz}/charges`, { body: { description: 'x', amount: 10 } })).status, 201);
  });
});

// ------------------------------------------------------------------------------------------------
describe('migration of existing data', { skip }, () => {
  const silently = async (fn) => {
    const log = console.log;
    console.log = () => {};
    try { return await fn(); } finally { console.log = log; }
  };

  before(async () => {
    await resetDatabase();
    // Students saved by the older version of the app: no academicStatus, no program link.
    const base = { dob: '2005-01-01', gender: 'Male', contactNumber: '0917', address: 'Manila', status: 'Enrolled', yearLevel: '1st Year', section: 'A' };
    await Student.collection.insertMany([
      { ...base, studentId: '2025-0001', firstName: 'Old', lastName: 'One', email: 'one@x.com', course: 'BSIT' },
      { ...base, studentId: '2025-0002', firstName: 'Old', lastName: 'Two', email: 'two@x.com', course: 'BSCS' },
      { ...base, studentId: '2025-0003', firstName: 'Old', lastName: 'Three', email: 'three@x.com', course: 'XYZ' }, // a code nobody defined
      { ...base, studentId: '2025-0004', firstName: 'Old', lastName: 'Four', email: 'four@x.com', course: '', status: 'Pending', yearLevel: '', section: '' },
    ]);
    await User.collection.insertOne({ name: 'Old Admin', email: 'old@x.com', password: 'hash', role: 'Administrator' });
  });

  test('links students to courses, fills in defaults, creates a calendar, and fixes old roles', async () => {
    await silently(migrate);

    assert.deepEqual((await Course.distinct('code')).sort(), ['BSA', 'BSCS', 'BSIT', 'XYZ']);
    assert.equal((await Course.findOne({ code: 'XYZ' })).name, 'XYZ', 'an unknown code gets a placeholder course');

    for (const s of await Student.find({ course: { $ne: '' } })) {
      assert.equal((await Course.findById(s.program)).code, s.course, s.studentId);
    }
    const noCourse = await Student.findOne({ studentId: '2025-0004' });
    assert.equal(noCourse.program, undefined, 'a student without a course gets no link');
    assert.equal(await Student.countDocuments({ academicStatus: 'Enrolled' }), 4);

    const terms = await Term.find();
    assert.equal(terms.length, 2);
    assert.equal(terms.filter((t) => t.isCurrent).length, 1);
    assert.equal(terms.filter((t) => t.enrollmentOpen).length, 1);
    assert.equal((await User.findOne({ email: 'old@x.com' })).role, 'admin');
  });

  test('running it again changes nothing (safe on every start-up)', async () => {
    const snapshot = async () => ({
      courses: await Course.countDocuments(), terms: await Term.countDocuments(), linked: await Student.countDocuments({ program: { $exists: true } }),
    });
    const before = await snapshot();
    await silently(migrate);
    await silently(migrate);
    assert.deepEqual(await snapshot(), before);
  });

  test('existing courses and terms are never overwritten', async () => {
    await Course.updateOne({ code: 'BSIT' }, { name: 'Renamed By An Admin', totalUnits: 999 });
    await silently(migrate);
    const bsit = await Course.findOne({ code: 'BSIT' });
    assert.equal(bsit.name, 'Renamed By An Admin');
    assert.equal(bsit.totalUnits, 999);
  });
});
