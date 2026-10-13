// The student portal API: always about the signed-in student. Everything is read-only except
// pre-enrollment (submit or cancel your own request).
//
// Who the student is comes ONLY from the login: `authenticate` loads the user from the token and
// `req.user.student` is the Student linked to that account. No route here takes a student id (or any
// other id that picks a person) from the URL, query or body, so there is nothing to tamper with:
// a student can read their own records and no one else's.

const express = require('express');
const mongoose = require('mongoose');
const { Student, Term, Subject, Offering, PreEnrollment, Attendance, Charge, Payment, Hold } = require('../models');
const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/roles');
const { computeStanding } = require('../services/gwa');
const { computeBalance } = require('../services/accounts');
const { termJson, loadRows, groupByTerm, standingInput, describeStanding } = require('../services/records');
const { buildTranscript } = require('../services/transcript');
const BRAND = require('../config/brand');
const pre = require('../services/preEnrollment');

const router = express.Router();
router.use(authenticate, requireRole('student'));
// Personal records: never let a browser or proxy keep a copy.
router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const LOW_ATTENDANCE_PCT = 75;
const MIN_RECORDS_FOR_ALERT = 5; // don't alarm anyone over one missed day
const peso = (n) => `PHP ${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// The signed-in student's record (with program), or a 404 if the link is somehow broken.
async function mine(req, res) {
  const student = await Student.findById(req.user.student).populate('program');
  if (!student) {
    res.status(404).json({ message: 'Your student record could not be found. Please contact the Registrar.' });
    return null;
  }
  return student;
}

const programJson = (p) => (p ? { code: p.code, name: p.name, department: p.department, years: p.years, totalUnits: p.totalUnits } : null);
const displayName = (s) => [s.firstName, s.middleName, s.lastName, s.suffix].filter(Boolean).join(' ');

// Only what the screen shows: no database ids of other records, no admin bookkeeping.
const gradedRow = (r) => ({
  subject: { code: r.subject.code, title: r.subject.title, units: r.subject.units, countsToGwa: r.subject.countsToGwa },
  section: r.offering.section,
  professor: r.offering.professor,
  status: r.status,
  grade: r.grade ? { value: r.grade.value, mark: r.grade.mark, remark: r.grade.remark, postedAt: r.grade.postedAt } : null,
});

// GET /api/portal/me -> who am I
router.get('/me', async (req, res) => {
  const s = await mine(req, res);
  if (!s) return undefined;
  return res.json({
    studentId: s.studentId,
    name: displayName(s),
    firstName: s.firstName,
    lastName: s.lastName,
    email: s.email,
    course: s.course,
    program: programJson(s.program),
    yearLevel: s.yearLevel,
    section: s.section,
    academicStatus: s.academicStatus,
    profilePicture: s.profilePicture,
  });
});

// GET /api/portal/dashboard -> standing at a glance, plus anything that needs attention
router.get('/dashboard', async (req, res) => {
  const s = await mine(req, res);
  if (!s) return undefined;

  const [rows, currentTerm, charges, payments, holds] = await Promise.all([
    loadRows(s._id),
    Term.findOne({ isCurrent: true }),
    Charge.find({ student: s._id }),
    Payment.find({ student: s._id }),
    Hold.find({ student: s._id, status: 'Active' }),
  ]);
  const standing = describeStanding(computeStanding(standingInput(rows), { unitsRequired: s.program?.totalUnits ?? null }), rows);
  const { balance } = computeBalance(charges, payments);
  const load = currentTerm ? rows.filter((r) => r.term.id === String(currentTerm._id) && r.status === 'Enrolled') : [];
  const unitsRequired = standing.unitsRequired;

  const alerts = [];
  for (const h of holds) {
    alerts.push({ code: 'HOLD', severity: 'error', message: `${h.type} hold: ${h.reason}` });
  }
  if (balance > 0) alerts.push({ code: 'BALANCE_DUE', severity: 'warning', message: `You have an outstanding balance of ${peso(balance)}.` });
  if (standing.outstandingFailures.length) {
    alerts.push({ code: 'FAILED_SUBJECTS', severity: 'warning', message: `Not yet passed: ${standing.outstandingFailures.map((x) => x.code).join(', ')}.` });
  }
  if (standing.incomplete.length) {
    alerts.push({ code: 'INCOMPLETE_GRADES', severity: 'warning', message: `Incomplete grade in ${standing.incomplete.map((x) => x.code).join(', ')}. Complete the requirements with your professor.` });
  }
  if (currentTerm) {
    const records = await Attendance.find({ student: s._id, term: currentTerm._id }).populate({ path: 'offering', populate: { path: 'subject', select: 'code' } });
    const perClass = new Map();
    for (const r of records) {
      const code = r.offering.subject.code;
      const c = perClass.get(code) || { present: 0, total: 0 };
      c.total += 1;
      if (r.status === 'Present') c.present += 1;
      perClass.set(code, c);
    }
    for (const [code, c] of perClass) {
      const rate = Math.round((c.present / c.total) * 100);
      if (c.total >= MIN_RECORDS_FOR_ALERT && rate < LOW_ATTENDANCE_PCT) {
        alerts.push({ code: 'LOW_ATTENDANCE', severity: 'warning', message: `Your attendance in ${code} is ${rate}%. Below ${LOW_ATTENDANCE_PCT}% may put the class at risk.` });
      }
    }
  }
  const preTerm = await pre.openTerm();
  if (preTerm) {
    const latest = await PreEnrollment.findOne({ student: s._id, term: preTerm._id }).sort({ submittedAt: -1 });
    if (latest?.status === 'Pending') alerts.push({ code: 'PRE_ENROLLMENT_PENDING', severity: 'info', message: `Your pre-enrollment for ${preTerm.name} is waiting for approval.` });
    else if (latest?.status === 'Approved') alerts.push({ code: 'PRE_ENROLLMENT_APPROVED', severity: 'success', message: `Your pre-enrollment for ${preTerm.name} was approved. Check My Schedule.` });
    else if (latest?.status === 'Rejected') alerts.push({ code: 'PRE_ENROLLMENT_REJECTED', severity: 'warning', message: `Your pre-enrollment for ${preTerm.name} was not approved: ${latest.note}` });
    if (!latest || ['Rejected', 'Cancelled'].includes(latest.status)) alerts.push({ code: 'PRE_ENROLLMENT_OPEN', severity: 'info', message: `Pre-enrollment for ${preTerm.name} is open.` });
  }
  if (s.academicStatus === 'LOA') alerts.push({ code: 'ON_LEAVE', severity: 'info', message: 'You are on a leave of absence. Contact the Registrar to return.' });
  if (s.academicStatus === 'Graduated') alerts.push({ code: 'GRADUATED', severity: 'success', message: 'Congratulations on your graduation!' });

  return res.json({
    student: { studentId: s.studentId, name: displayName(s), program: programJson(s.program), yearLevel: s.yearLevel, section: s.section, academicStatus: s.academicStatus },
    gwa: standing.gwa,
    units: {
      earned: standing.unitsEarned,
      required: unitsRequired,
      remaining: standing.unitsRemaining,
      progressPercent: unitsRequired ? Math.min(100, Math.round((standing.unitsEarned / unitsRequired) * 100)) : null,
    },
    currentTerm: currentTerm ? termJson(currentTerm) : null,
    currentLoad: { subjects: load.length, units: load.reduce((sum, r) => sum + r.subject.units, 0) },
    balance,
    activeHolds: holds.length,
    alerts,
  });
});

// GET /api/portal/schedule?term=<id> -> the week as a timetable (defaults to the current term)
router.get('/schedule', async (req, res) => {
  const s = await mine(req, res);
  if (!s) return undefined;
  const rows = (await loadRows(s._id)).filter((r) => r.status !== 'Dropped');

  const termsSeen = groupByTerm(rows).map((g) => g.term);
  const requested = typeof req.query.term === 'string' && mongoose.isValidObjectId(req.query.term) ? req.query.term : null;
  const current = termsSeen.find((t) => t.isCurrent);
  const term = termsSeen.find((t) => t.id === requested) || current || termsSeen[0] || null;
  const inTerm = term ? rows.filter((r) => r.term.id === term.id) : [];

  const days = DAYS.map((day) => ({ day, classes: [] }));
  for (const r of inTerm) {
    for (const m of r.offering.meetings) {
      days.find((d) => d.day === m.day)?.classes.push({
        code: r.subject.code,
        title: r.subject.title,
        units: r.subject.units,
        section: r.offering.section,
        professor: r.offering.professor,
        room: m.room || '',
        start: m.start,
        end: m.end,
      });
    }
  }
  for (const d of days) d.classes.sort((a, b) => a.start.localeCompare(b.start));

  return res.json({
    term,
    terms: termsSeen.map((t) => ({ id: t.id, name: t.name, isCurrent: t.isCurrent })),
    days,
    classes: inTerm
      .map((r) => ({ code: r.subject.code, title: r.subject.title, units: r.subject.units, section: r.offering.section, professor: r.offering.professor, status: r.status, meetings: r.offering.meetings }))
      .sort((a, b) => a.code.localeCompare(b.code)),
    totalUnits: inTerm.reduce((sum, r) => sum + r.subject.units, 0),
  });
});

// GET /api/portal/grades -> grades grouped by semester (newest first), with each semester's GWA and the overall standing
router.get('/grades', async (req, res) => {
  const s = await mine(req, res);
  if (!s) return undefined;
  const rows = await loadRows(s._id);
  const terms = groupByTerm(rows).map((g) => ({
    term: g.term,
    rows: g.rows.filter((r) => r.status !== 'Dropped' || r.grade).map(gradedRow),
    standing: computeStanding(standingInput(g.rows)),
  }));
  const overall = describeStanding(computeStanding(standingInput(rows), { unitsRequired: s.program?.totalUnits ?? null }), rows);
  return res.json({ terms, overall });
});

// GET /api/portal/accounts -> statement of account, payments and holds, with a simple clearance verdict
router.get('/accounts', async (req, res) => {
  const s = await mine(req, res);
  if (!s) return undefined;
  const [charges, payments, holds] = await Promise.all([
    Charge.find({ student: s._id }).populate('term', 'academicYear semester').sort({ createdAt: -1, _id: -1 }),
    Payment.find({ student: s._id }).populate('term', 'academicYear semester').sort({ paidAt: -1 }),
    Hold.find({ student: s._id }).sort({ status: 1, placedAt: -1 }), // Active before Cleared
  ]);
  const totals = computeBalance(charges, payments);
  const activeHolds = holds.filter((h) => h.status === 'Active').length;
  const termName = (t) => (t ? t.name : null);
  return res.json({
    ...totals,
    clearance: { cleared: activeHolds === 0 && totals.balance <= 0, activeHolds, balanceDue: Math.max(totals.balance, 0) },
    charges: charges.map((c) => ({ category: c.category, description: c.description, amount: c.amount, dueDate: c.dueDate, term: termName(c.term) })),
    payments: payments.map((p) => ({ receiptNo: p.receiptNo ?? '', method: p.method, amount: p.amount, paidAt: p.paidAt, term: termName(p.term) })),
    holds: holds.map((h) => ({ type: h.type, reason: h.reason, status: h.status, placedAt: h.placedAt, clearedAt: h.clearedAt })),
  });
});

// GET /api/portal/transcript.pdf -> unofficial transcript, every page marked UNOFFICIAL
router.get('/transcript.pdf', async (req, res) => {
  const s = await mine(req, res);
  if (!s) return undefined;
  const rows = await loadRows(s._id);

  const gradeCell = (g) => (g ? (g.value !== null ? g.value.toFixed(2) : g.mark) : 'IP');
  // Oldest term first, like a printed transcript. Classes still in progress show "IP"; dropped ones show only if a DRP/W was recorded.
  const terms = groupByTerm(rows)
    .reverse()
    .map((g) => {
      const shown = g.rows.filter((r) => r.grade || r.status === 'Enrolled');
      return {
        name: g.term.name,
        gwa: computeStanding(standingInput(g.rows)).gwa,
        rows: shown.map((r) => ({
          code: r.subject.code,
          title: r.subject.title,
          units: r.subject.units,
          grade: gradeCell(r.grade),
          remark: r.grade ? r.grade.remark : 'In progress',
        })),
      };
    })
    .filter((t) => t.rows.length > 0);
  const overall = computeStanding(standingInput(rows), { unitsRequired: s.program?.totalUnits ?? null });

  const pdf = await buildTranscript({
    institution: BRAND.name,
    system: BRAND.system,
    student: {
      name: displayName(s),
      studentId: s.studentId,
      program: s.program ? `${s.program.code} - ${s.program.name}` : s.course,
      department: s.program?.department,
      yearLevel: s.yearLevel,
      section: s.section,
      academicStatus: s.academicStatus,
    },
    terms,
    overall: { gwa: overall.gwa, unitsEarned: overall.unitsEarned, unitsRequired: overall.unitsRequired },
    generatedAt: new Date(),
  });

  res.set({
    'Content-Type': 'application/pdf',
    'Content-Length': pdf.length,
    'Content-Disposition': `attachment; filename="UNOFFICIAL-Transcript-${s.studentId}.pdf"`,
  });
  return res.send(pdf);
});

// ---- Pre-enrollment ----------------------------------------------------------------------------
const MAX_PICKS = 12;
const validIds = (v) => Array.isArray(v) && v.length <= MAX_PICKS && v.every((x) => typeof x === 'string' && mongoose.isValidObjectId(x));
const escapeRegex = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// GET /api/portal/pre-enrollment -> can I pre-enroll, what are the limits, and what have I submitted?
router.get('/pre-enrollment', async (req, res) => {
  const s = await mine(req, res);
  if (!s) return undefined;
  const term = await pre.openTerm();
  const history = await PreEnrollment.find({ student: s._id }).sort({ submittedAt: -1 }).limit(20).populate(pre.POPULATE);
  const requests = history.map(pre.requestJson);
  const pendingRequest = requests.find((r) => r.status === 'Pending' && term && r.term.id === String(term._id)) || null;

  const blockers = [];
  const notices = [];
  let existingUnits = 0;
  if (!term) blockers.push({ code: 'TERM_CLOSED', message: 'Pre-enrollment is not open right now. Watch this page for the announcement.' });
  else {
    const ctx = await pre.loadContext(s._id, term._id);
    existingUnits = ctx.termUnits;
    if (s.academicStatus !== 'Enrolled') blockers.push({ code: 'STUDENT_NOT_ACTIVE', message: `Pre-enrollment is for actively enrolled students. Your status is ${s.academicStatus}.` });
    const blocking = ctx.holds.filter((h) => pre.RULES.BLOCKING_HOLD_TYPES.includes(h.type));
    if (blocking.length) blockers.push({ code: 'HOLD', message: `You have an active ${blocking.map((h) => h.type).join(', ')} hold. Clear it with the office concerned before pre-enrolling.` });
    for (const h of ctx.holds.filter((x) => !blocking.includes(x))) notices.push({ code: 'HOLD_ADVISORY', message: `You have an active ${h.type} hold. It does not stop pre-enrollment, but please settle it.` });
    if (pendingRequest) blockers.push({ code: 'ALREADY_PENDING', message: 'You have a request waiting for approval. Cancel it first if you want to change your subjects.' });
  }
  return res.json({
    term: term ? termJson(term) : null,
    canSubmit: blockers.length === 0,
    blockers,
    notices,
    limits: { maxUnits: pre.RULES.MAX_UNITS, regularMinUnits: pre.RULES.REGULAR_MIN_UNITS },
    existingUnits,
    pending: pendingRequest,
    history: requests,
  });
});

// GET /api/portal/pre-enrollment/offerings?search= -> the open term's classes, each judged for ME
router.get('/pre-enrollment/offerings', async (req, res) => {
  const s = await mine(req, res);
  if (!s) return undefined;
  const term = await pre.openTerm();
  if (!term) return res.json({ term: null, offerings: [] });

  const filter = { term: term._id };
  const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 40) : '';
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    filter.subject = { $in: await Subject.find({ $or: [{ code: rx }, { title: rx }] }).limit(100).distinct('_id') };
  }
  const [offerings, ctx] = await Promise.all([
    Offering.find(filter).populate({ path: 'subject', populate: { path: 'prerequisites', select: 'code' } }).limit(150),
    pre.loadContext(s._id, term._id),
  ]);
  // "Recommended": the subjects of the student's own program for the year and semester they reach next.
  const years = ['1st Year', '2nd Year', '3rd Year', '4th Year'];
  const now = years.indexOf(s.yearLevel);
  const targetYear = years[Math.min(term.semester === '1st Semester' ? now + 1 : now, years.length - 1)];
  const recommended = (subject) =>
    Boolean(s.program) && subject.curriculum.some((c) => String(c.course) === String(s.program._id) && c.yearLevel === targetYear && c.semester === term.semester);

  const rows = offerings
    .sort((a, b) => a.subject.code.localeCompare(b.subject.code) || a.section.localeCompare(b.section))
    .map((o) => {
      const { problems, warnings } = pre.checkOffering(ctx, o);
      return {
        id: String(o._id),
        section: o.section,
        professor: o.professor,
        capacity: o.capacity,
        seatsLeft: Math.max(o.capacity - o.enrolledCount, 0),
        meetings: o.meetings.map((m) => ({ day: m.day, start: m.start, end: m.end, room: m.room })),
        subject: { code: o.subject.code, title: o.subject.title, units: o.subject.units, prerequisites: o.subject.prerequisites.map((p) => p.code) },
        recommended: recommended(o.subject),
        selectable: problems.length === 0,
        problems,
        warnings,
      };
    });
  return res.json({ term: termJson(term), offerings: rows });
});

// POST /api/portal/pre-enrollment/validate  { offeringIds }  -> dry run of the checks, nothing is saved
router.post('/pre-enrollment/validate', async (req, res) => {
  const s = await mine(req, res);
  if (!s) return undefined;
  const { offeringIds } = req.body || {};
  if (!validIds(offeringIds)) return res.status(400).json({ message: `offeringIds must be a list of at most ${MAX_PICKS} class ids` });
  const r = await pre.evaluateSelection(s._id, offeringIds, { requireOpenTerm: true, blockOnHolds: true });
  return res.json({ ok: r.ok, totalUnits: r.totalUnits, existingUnits: r.existingUnits, problems: r.problems, warnings: r.warnings });
});

// POST /api/portal/pre-enrollment  { offeringIds }  -> submit a request (it waits as Pending for approval)
router.post('/pre-enrollment', async (req, res) => {
  const s = await mine(req, res);
  if (!s) return undefined;
  const { offeringIds } = req.body || {};
  if (!validIds(offeringIds)) return res.status(400).json({ message: `offeringIds must be a list of at most ${MAX_PICKS} class ids` });
  const created = await pre.submitPreEnrollment(s._id, offeringIds);
  const full = await PreEnrollment.findById(created._id).populate(pre.POPULATE);
  return res.status(201).json(pre.requestJson(full));
});

// DELETE /api/portal/pre-enrollment/:id -> withdraw my own pending request
router.delete('/pre-enrollment/:id', async (req, res) => {
  const s = await mine(req, res);
  if (!s) return undefined;
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Pre-enrollment request not found' });
  await pre.cancelPreEnrollment(req.params.id, s._id);
  return res.json({ message: 'Your request was cancelled.' });
});

module.exports = router;
