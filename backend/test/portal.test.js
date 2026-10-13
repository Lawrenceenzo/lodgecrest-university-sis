// Tests for the student portal API (/api/portal/*) and the unofficial transcript PDF.
//
//   MONGO_TEST_URI="mongodb://127.0.0.1:27017/lodgecrest_test" npm test
//
// Like the other database tests, these ERASE the database they connect to (its name must contain "test").

const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const zlib = require('node:zlib');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-not-for-production';

const URI = process.env.MONGO_TEST_URI;
const skip = URI ? false : 'set MONGO_TEST_URI to run the database tests';

const models = require('../models');
const { Student, User, Term, Offering, Enrollment, Attendance, Hold } = models;
const { runSeed } = require('../seed/index');
const { buildTranscript } = require('../services/transcript');
const app = require('../app');

async function resetDatabase() {
  const name = mongoose.connection.name;
  if (!/test/i.test(name)) throw new Error(`Refusing to erase database "${name}": its name must contain "test".`);
  await mongoose.connection.dropDatabase();
  await Promise.all(Object.values(models).map((M) => M.syncIndexes()));
}

// The text that each page of a PDF draws, as one string per page (the real, compressed output).
function pdfPageTexts(buffer) {
  const raw = buffer.toString('latin1');
  const pages = [];
  const streams = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let m;
  while ((m = streams.exec(raw))) {
    let content;
    try {
      content = zlib.inflateSync(Buffer.from(m[1], 'latin1')).toString('latin1');
    } catch {
      continue; // not a content stream
    }
    const lines = [];
    for (const [, arr] of content.matchAll(/\[([^\]]*)\]\s*TJ/g)) {
      const hex = [...arr.matchAll(/<([0-9a-f]*)>/gi)].map((x) => x[1]).join('');
      lines.push(Buffer.from(hex, 'hex').toString('latin1'));
    }
    if (lines.length) pages.push(lines);
  }
  return pages;
}
const pageCount = (buffer) => (buffer.toString('latin1').match(/\/Type \/Page\b(?!s)/g) || []).length;

describe('student portal API', { skip }, () => {
  let server;
  let base;
  let santos; // Student documents by student number
  const S = {};
  const tokens = {};

  const sign = (user) => jwt.sign({ id: String(user._id), role: user.role, tv: user.tokenVersion ?? 0 }, process.env.JWT_SECRET, { expiresIn: '1h' });
  async function get(path, token) {
    const res = await fetch(base + path, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    const type = res.headers.get('content-type') || '';
    return { status: res.status, headers: res.headers, json: type.includes('json') ? await res.json() : null, buffer: Buffer.from(await res.arrayBuffer().catch(() => new ArrayBuffer(0))) };
  }
  // A portal login for a seeded student (only Santos has one out of the box).
  const loginFor = async (number) => {
    const s = S[number];
    const user = await User.create({ name: `${s.firstName} ${s.lastName}`, email: `portal-${number}@example.test`, password: 'not-used-in-these-tests', role: 'student', student: s._id });
    tokens[number] = sign(user);
    return user;
  };

  before(async () => {
    await mongoose.connect(URI);
    await resetDatabase();
    await runSeed({ log: () => {} });
    for (const s of await Student.find()) S[s.studentId] = s;
    santos = S['2026-0001'];
    tokens['2026-0001'] = sign(await User.findOne({ role: 'student' }));
    tokens.admin = sign(await User.findOne({ role: 'admin' }));
    await loginFor('2026-0002'); // Reyes
    await loginFor('2026-0005'); // Garcia, the graduate
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${server.address().port}/api/portal`;
  });
  after(async () => {
    if (server) {
      server.closeAllConnections?.();
      await new Promise((resolve) => server.close(resolve));
    }
    await mongoose.disconnect();
  });

  const ENDPOINTS = ['/me', '/dashboard', '/schedule', '/grades', '/accounts', '/transcript.pdf'];

  test('signed-in students only: no token is 401, an administrator is 403', async () => {
    for (const path of ENDPOINTS) {
      assert.equal((await get(path)).status, 401, `${path} without a token`);
      assert.equal((await get(path, tokens.admin)).status, 403, `${path} as an administrator`);
    }
  });

  test('the portal is read-only: anything but GET is refused', async () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      for (const path of ['/me', '/grades', '/accounts']) {
        const res = await fetch(base + path, { method, headers: { Authorization: `Bearer ${tokens['2026-0001']}`, 'Content-Type': 'application/json' }, body: method === 'DELETE' ? undefined : '{}' });
        assert.equal(res.status, 404, `${method} ${path}`);
      }
    }
  });

  test('identity comes from the token alone: other students\' ids in the URL are ignored', async () => {
    const reyes = S['2026-0002'];
    const own = (await get('/me', tokens['2026-0001'])).json;
    assert.equal(own.studentId, '2026-0001');
    assert.equal((await get('/me', tokens['2026-0002'])).json.studentId, '2026-0002');

    // Santos tries every way of asking for Reyes's records; each still answers with Santos's own.
    const grabs = [`?studentId=${reyes._id}`, `?student=${reyes._id}`, `?id=${reyes._id}`, `?studentId=2026-0002`, `?user=${reyes._id}`];
    for (const q of grabs) {
      for (const path of ['/me', '/dashboard', '/grades', '/accounts', '/schedule']) {
        const { status, json } = await get(path + q, tokens['2026-0001']);
        assert.equal(status, 200);
        const who = json.studentId ?? json.student?.studentId;
        if (who) assert.equal(who, '2026-0001', `${path}${q}`);
      }
    }
    const own2 = (await get(`/grades?studentId=${reyes._id}`, tokens['2026-0001'])).json;
    const base2 = (await get('/grades', tokens['2026-0001'])).json;
    assert.deepEqual(own2, base2, 'the extra parameter changes nothing');
    assert.notDeepEqual((await get('/grades', tokens['2026-0002'])).json, base2, 'and Reyes sees different records');
    // No URL shape lets a student address someone else: there is no /portal/<id> route at all.
    assert.equal((await get(`/${reyes._id}`, tokens['2026-0001'])).status, 404);
    assert.equal((await get(`/students/${reyes._id}/grades`, tokens['2026-0001'])).status, 404);
  });

  test('a student whose record is archived loses portal access at once, even with a valid token', async () => {
    const reyes = S['2026-0002'];
    assert.equal((await get('/dashboard', tokens['2026-0002'])).status, 200);
    await Student.updateOne({ _id: reyes._id }, { academicStatus: 'Archived' });
    const blocked = await get('/dashboard', tokens['2026-0002']);
    assert.deepEqual([blocked.status, blocked.json.code], [403, 'ACCOUNT_INACTIVE']);
    await Student.updateOne({ _id: reyes._id }, { academicStatus: 'Enrolled' });
    assert.equal((await get('/dashboard', tokens['2026-0002'])).status, 200);
  });

  test('responses are marked no-store so browsers and proxies do not keep personal records', async () => {
    for (const path of ENDPOINTS) {
      assert.match((await get(path, tokens['2026-0001'])).headers.get('cache-control'), /no-store/, path);
    }
  });

  test('dashboard: GWA, units against the program, load, balance and alerts', async () => {
    const d = (await get('/dashboard', tokens['2026-0001'])).json;
    assert.equal(d.student.studentId, '2026-0001');
    assert.equal(d.student.program.code, 'BSIT');
    assert.equal(d.gwa, 1.5);
    assert.deepEqual(d.units, { earned: 31, required: 131, remaining: 100, progressPercent: 24 });
    assert.equal(d.currentTerm.name, '2026-2027 1st Semester');
    assert.deepEqual(d.currentLoad, { subjects: 6, units: 17 });
    assert.equal(d.balance, 11950);
    assert.equal(d.activeHolds, 1);

    const codes = d.alerts.map((a) => a.code);
    assert.ok(codes.includes('HOLD') && codes.includes('BALANCE_DUE') && codes.includes('INCOMPLETE_GRADES'));
    assert.match(d.alerts.find((a) => a.code === 'HOLD').message, /Library hold/);
    assert.match(d.alerts.find((a) => a.code === 'BALANCE_DUE').message, /PHP 11,950\.00/);
    assert.match(d.alerts.find((a) => a.code === 'INCOMPLETE_GRADES').message, /IT104/);
    assert.ok(d.alerts.every((a) => ['error', 'warning', 'info', 'success'].includes(a.severity)));
  });

  test('dashboard: attendance alerts match the records, and need at least a few of them', async () => {
    const current = await Term.findOne({ isCurrent: true });
    const records = await Attendance.find({ student: santos._id, term: current._id }).populate({ path: 'offering', populate: { path: 'subject' } });
    const perClass = {};
    for (const r of records) {
      const c = (perClass[r.offering.subject.code] ||= { present: 0, total: 0 });
      c.total += 1;
      if (r.status === 'Present') c.present += 1;
    }
    const expected = Object.entries(perClass).filter(([, c]) => c.total >= 5 && Math.round((c.present / c.total) * 100) < 75).map(([code]) => code).sort();
    const reported = (await get('/dashboard', tokens['2026-0001'])).json.alerts.filter((a) => a.code === 'LOW_ATTENDANCE').map((a) => a.message.match(/in (\w+) is/)[1]).sort();
    assert.deepEqual(reported, expected);

    // Missing one class out of two is not an alert.
    const enrollment = await Enrollment.findOne({ student: S['2026-0002']._id, term: current._id, status: 'Enrolled' });
    await Attendance.deleteMany({ student: S['2026-0002']._id });
    await Attendance.create([
      { student: S['2026-0002']._id, offering: enrollment.offering, date: '2026-10-05', status: 'Absent' },
      { student: S['2026-0002']._id, offering: enrollment.offering, date: '2026-10-06', status: 'Present' },
    ]);
    assert.equal((await get('/dashboard', tokens['2026-0002'])).json.alerts.some((a) => a.code === 'LOW_ATTENDANCE'), false);
  });

  test('dashboard: a graduate sees congratulations and a full progress bar', async () => {
    const d = (await get('/dashboard', tokens['2026-0005'])).json;
    assert.equal(d.units.progressPercent, 100);
    assert.equal(d.units.remaining, 0);
    assert.ok(d.alerts.some((a) => a.code === 'GRADUATED' && a.severity === 'success'));
    assert.deepEqual(d.currentLoad, { subjects: 0, units: 0 });
  });

  test('dashboard: an open pre-enrollment term is announced', async () => {
    const d = (await get('/dashboard', tokens['2026-0001'])).json;
    const alert = d.alerts.find((a) => a.code === 'PRE_ENROLLMENT_OPEN');
    assert.match(alert.message, /2026-2027 2nd Semester/);
    assert.equal(alert.severity, 'info');
  });

  test('schedule: the week as a timetable, sorted by time, Monday to Saturday', async () => {
    const s = (await get('/schedule', tokens['2026-0001'])).json;
    assert.equal(s.term.name, '2026-2027 1st Semester');
    assert.deepEqual(s.days.map((d) => d.day), ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
    assert.equal(s.classes.length, 6);
    assert.equal(s.totalUnits, 17);
    for (const d of s.days) {
      assert.deepEqual(d.classes.map((c) => c.start), d.classes.map((c) => c.start).sort(), `${d.day} is in time order`);
    }
    // Every meeting of every class appears exactly once on the right day.
    const meetings = s.classes.reduce((n, c) => n + c.meetings.length, 0);
    assert.equal(s.days.reduce((n, d) => n + d.classes.length, 0), meetings);
    const ge103 = s.classes.find((c) => c.code === 'GE103');
    for (const m of ge103.meetings) {
      assert.ok(s.days.find((d) => d.day === m.day).classes.some((c) => c.code === 'GE103' && c.start === m.start && c.room === (m.room || '')));
    }
    assert.equal(s.terms.length, 3);
  });

  test('schedule: another term can be chosen; a bad or foreign term falls back safely', async () => {
    const all = (await get('/schedule', tokens['2026-0001'])).json.terms;
    const past = all.find((t) => !t.isCurrent);
    const old = (await get(`/schedule?term=${past.id}`, tokens['2026-0001'])).json;
    assert.equal(old.term.id, past.id);
    assert.ok(old.classes.length > 0);

    assert.equal((await get('/schedule?term=garbage', tokens['2026-0001'])).json.term.isCurrent, true);
    // A term the student never enrolled in is not something they can browse: they simply get the current one.
    const strange = await Term.findOne({ _id: { $nin: all.map((t) => t.id) } });
    const fallback = (await get(`/schedule?term=${strange._id}`, tokens['2026-0001'])).json;
    assert.equal(fallback.term.isCurrent, true);
    assert.deepEqual(fallback.classes, (await get('/schedule', tokens['2026-0001'])).json.classes);
  });

  test('schedule: dropped classes do not appear', async () => {
    const current = await Term.findOne({ isCurrent: true });
    const e = await Enrollment.findOne({ student: S['2026-0002']._id, term: current._id, status: 'Enrolled' }).populate('subject');
    const before = (await get('/schedule', tokens['2026-0002'])).json;
    assert.ok(before.classes.some((c) => c.code === e.subject.code));
    await Enrollment.updateOne({ _id: e._id }, { status: 'Dropped' });
    const after = (await get('/schedule', tokens['2026-0002'])).json;
    assert.equal(after.classes.some((c) => c.code === e.subject.code), false);
    await Enrollment.updateOne({ _id: e._id }, { status: 'Enrolled' });
  });

  test('grades: grouped by semester, newest first, with each semester\'s GWA and the overall standing', async () => {
    const g = (await get('/grades', tokens['2026-0001'])).json;
    assert.deepEqual(g.terms.map((t) => t.term.name), ['2026-2027 1st Semester', '2025-2026 2nd Semester', '2025-2026 1st Semester']);
    assert.equal(g.terms[0].standing.gwa, null, 'nothing graded in the current term yet');
    assert.equal(g.terms[1].standing.gwa, 1.42);
    assert.ok(g.terms[0].rows.every((r) => r.status === 'Enrolled' && r.grade === null));
    const inc = g.terms[1].rows.find((r) => r.subject.code === 'IT104');
    assert.deepEqual([inc.grade.mark, inc.grade.remark, inc.grade.value], ['INC', 'Incomplete', null]);
    assert.equal(g.terms[1].rows.find((r) => r.subject.code === 'PE2').subject.countsToGwa, false);
    assert.equal(g.overall.gwa, 1.5);
    assert.equal(g.overall.unitsEarned, 31);
    assert.equal(g.overall.unitsRemaining, 100);
    assert.deepEqual(g.overall.incomplete.map((x) => x.code), ['IT104']);
  });

  test('grades: a student sees nothing that belongs to the office (no ids, no staff names)', async () => {
    const grades = (await get('/grades', tokens['2026-0001'])).json;
    const accounts = (await get('/accounts', tokens['2026-0001'])).json;
    const text = JSON.stringify(grades) + JSON.stringify(accounts);
    // Terms carry an id (the schedule picker needs it); nothing that identifies a record of a person does.
    const items = [...grades.terms.flatMap((t) => t.rows), ...accounts.charges, ...accounts.payments, ...accounts.holds];
    assert.ok(items.length > 0 && items.every((x) => !('id' in x)), 'rows, charges, payments and holds carry no ids');
    for (const leaked of ['postedBy', 'recordedBy', 'placedBy', 'clearedBy', '"_id"', 'password', 'tokenVersion']) {
      assert.equal(text.includes(leaked), false, `${leaked} must not appear: ${text.slice(Math.max(0, text.indexOf(leaked) - 60), text.indexOf(leaked) + 60)}`);
    }
  });

  test('grades: a class dropped without any mark is hidden, one dropped with DRP stays on the record', async () => {
    const current = await Term.findOne({ isCurrent: true });
    const [a, b] = await Enrollment.find({ student: S['2026-0002']._id, term: current._id, status: 'Enrolled' }).populate('subject').limit(2);
    await models.Grade.create({ student: S['2026-0002']._id, enrollment: b._id, mark: 'DRP' }); // graded while the class was still running
    await Enrollment.updateOne({ _id: a._id }, { status: 'Dropped' });
    await Enrollment.updateOne({ _id: b._id }, { status: 'Dropped' });
    const rows = (await get('/grades', tokens['2026-0002'])).json.terms.find((t) => t.term.isCurrent).rows;
    assert.equal(rows.some((r) => r.subject.code === a.subject.code), false);
    assert.equal(rows.find((r) => r.subject.code === b.subject.code).grade.remark, 'Dropped');
  });

  test('accounts: statement, payments, holds and a clearance verdict', async () => {
    const a = (await get('/accounts', tokens['2026-0001'])).json;
    assert.equal(a.balance, 11950);
    assert.equal(a.totalCharges - a.totalPayments, a.balance);
    assert.deepEqual(a.clearance, { cleared: false, activeHolds: 1, balanceDue: 11950 });
    assert.equal(a.holds[0].status, 'Active');
    assert.equal(a.holds[0].type, 'Library');
    assert.ok(a.payments.length >= 1 && a.payments.every((p) => p.receiptNo && p.method));
    assert.ok(a.charges.every((c) => typeof c.amount === 'number' && c.term));

    const clear = (await get('/accounts', tokens['2026-0005'])).json;
    assert.equal(clear.clearance.cleared, true, 'a graduate with nothing owed and no holds is cleared');
  });

  test('accounts: clearing a hold and paying in full is reflected immediately', async () => {
    const maria = S['2026-0001'];
    const before = (await get('/accounts', tokens['2026-0001'])).json;
    await Hold.updateMany({ student: maria._id, status: 'Active' }, { status: 'Cleared', clearedAt: new Date() });
    await models.Payment.create({ student: maria._id, amount: before.balance, method: 'Cash', receiptNo: 'OR-PORTAL-TEST' });
    const after = (await get('/accounts', tokens['2026-0001'])).json;
    assert.deepEqual(after.clearance, { cleared: true, activeHolds: 0, balanceDue: 0 });
    assert.equal(after.balance, 0);
    assert.equal((await get('/dashboard', tokens['2026-0001'])).json.alerts.some((x) => x.code === 'HOLD' || x.code === 'BALANCE_DUE'), false);
  });

  test('transcript PDF: downloads as a real PDF named for the student, marked UNOFFICIAL', async () => {
    const res = await get('/transcript.pdf', tokens['2026-0001']);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'application/pdf');
    assert.match(res.headers.get('content-disposition'), /attachment; filename="UNOFFICIAL-Transcript-2026-0001\.pdf"/);
    assert.equal(res.buffer.subarray(0, 5).toString(), '%PDF-');
    assert.ok(res.buffer.subarray(-16).toString().includes('%%EOF'));

    const pages = pdfPageTexts(res.buffer);
    assert.equal(pages.length, pageCount(res.buffer));
    const all = pages.flat().join('\n');
    for (const needle of ['LODGECREST UNIVERSITY', 'UNOFFICIAL TRANSCRIPT OF RECORDS', 'Maria Angela Santos', '2026-0001', '2025-2026 1st Semester', 'Term GWA: 1.42', 'Cumulative GWA', '1.50', '31 of 131 required']) {
      assert.ok(all.includes(needle), `the transcript should say "${needle}"`);
    }
    assert.ok(all.includes('IP'), 'classes in progress are shown as IP');
    assert.ok(all.includes('INC'), 'incomplete marks are shown');
  });

  test('transcript PDF: every page of a long transcript carries the watermark, banner and footer', async () => {
    const terms = Array.from({ length: 14 }, (_, i) => ({
      name: `Term ${i + 1}`,
      gwa: 1.75,
      rows: Array.from({ length: 8 }, (_, j) => ({ code: `X${i}${j}`, title: 'A subject whose title is so long that it has to be cut short to stay inside its column', units: 3, grade: '1.75', remark: 'Passed' })),
    }));
    const buffer = await buildTranscript({
      institution: 'Lodgecrest University',
      system: 'Student Information System',
      student: { name: 'Test Student', studentId: '2026-9999', program: 'BSIT', department: 'Computing', yearLevel: '4th Year', section: 'A', academicStatus: 'Enrolled' },
      terms,
      overall: { gwa: 1.75, unitsEarned: 100, unitsRequired: 131 },
      generatedAt: new Date(),
    });
    const count = pageCount(buffer);
    assert.ok(count >= 4, `expected a multi-page document, got ${count}`);
    const pages = pdfPageTexts(buffer);
    assert.equal(pages.length, count);
    pages.forEach((lines, i) => {
      assert.ok(lines.includes('UNOFFICIAL'), `page ${i + 1} has the watermark`);
      assert.ok(lines.includes('UNOFFICIAL COPY - NOT VALID FOR ANY OFFICIAL PURPOSE'), `page ${i + 1} has the banner`);
      assert.ok(lines.some((l) => l.startsWith('UNOFFICIAL - Lodgecrest University - Page ') && l.endsWith(` of ${count}`)), `page ${i + 1} has the footer`);
      assert.ok(lines.includes(`UNOFFICIAL - Lodgecrest University - Page ${i + 1} of ${count}`), `page ${i + 1} is numbered ${i + 1}`);
    });
    assert.ok(pages.slice(1).every((lines) => lines.some((l) => l.includes('(continued)'))), 'later pages say whose record continues');
    assert.ok(pages.flat().some((l) => l.endsWith('...')), 'over-long titles are cut, never wrapped over other rows');
  });

  test('transcript PDF: a student with no records still gets a marked, valid document', async () => {
    const buffer = await buildTranscript({
      institution: 'Lodgecrest University',
      system: 'Student Information System',
      student: { name: 'New Student', studentId: '2026-9998', program: '', department: '', yearLevel: '1st Year', section: '', academicStatus: 'Enrolled' },
      terms: [],
      overall: { gwa: null, unitsEarned: 0, unitsRequired: null },
      generatedAt: new Date(),
    });
    const pages = pdfPageTexts(buffer);
    assert.equal(pages.length, 1);
    assert.ok(pages[0].includes('UNOFFICIAL'));
    assert.ok(pages[0].includes('No academic records yet.'));
  });

  test('transcript PDF: it always describes the signed-in student, never another', async () => {
    const a = pdfPageTexts((await get('/transcript.pdf', tokens['2026-0005'])).buffer).flat().join('\n');
    assert.ok(a.includes('2026-0005'));
    assert.equal(a.includes('2026-0001'), false);
    const viaQuery = pdfPageTexts((await get(`/transcript.pdf?studentId=${santos._id}`, tokens['2026-0005'])).buffer).flat().join('\n');
    assert.ok(viaQuery.includes('2026-0005') && !viaQuery.includes('2026-0001'));
  });
});
