// Admin endpoints behind the student profile tabs: academic summary, enrollment history, grades,
// attendance, and accounts & holds - plus the actions that change them.
// Everything here is admin-only. (The student portal gets its own read-only API in a later step.)

const express = require('express');
const mongoose = require('mongoose');
const { Student, Term, Subject, Offering, Enrollment, Grade, Attendance, Charge, Payment, Hold } = require('../models');
const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/roles');
const { computeStanding } = require('../services/gwa');
const { computeBalance } = require('../services/accounts');
const { enrollStudent, dropEnrollment } = require('../services/enrollment');
const { termJson, meetingJson, loadRows, groupByTerm, standingInput, describeStanding } = require('../services/records');

const router = express.Router();

// This router is mounted at /api, so the guard is limited to the paths it owns.
router.use(['/students', '/enrollments', '/attendance', '/charges', '/payments', '/holds', '/terms', '/offerings'], authenticate, requireRole('admin'));

// ---------------------------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------------------------
const validId = (id) => typeof id === 'string' && mongoose.isValidObjectId(id);
const notFound = (res, what) => res.status(404).json({ message: `${what} not found` });
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const DROP_MARKS = ['DRP', 'W'];

// Loads the student named in the URL, or answers 404 and returns null.
async function loadStudent(req, res) {
  if (!validId(req.params.id)) {
    notFound(res, 'Student');
    return null;
  }
  const student = await Student.findById(req.params.id);
  if (!student) notFound(res, 'Student');
  return student;
}

// Archived records are read-only until restored.
function refuseIfArchived(student, res) {
  if (student.academicStatus !== 'Archived') return false;
  res.status(409).json({ message: 'This record is archived. Restore it before making changes.' });
  return true;
}

// ---------------------------------------------------------------------------------------------
// Catalog lookups used by the dialogs
// ---------------------------------------------------------------------------------------------

// GET /api/terms -> all terms, newest first
router.get('/terms', async (req, res) => {
  const terms = await Term.find().sort({ startDate: -1 });
  res.json(terms.map(termJson));
});

// PATCH /api/terms/:id  { enrollmentOpen }  -> open or close pre-enrollment for a term
router.patch('/terms/:id', async (req, res) => {
  if (!validId(req.params.id)) return notFound(res, 'Term');
  if (typeof req.body?.enrollmentOpen !== 'boolean') return res.status(400).json({ message: 'enrollmentOpen must be true or false' });
  const term = await Term.findByIdAndUpdate(req.params.id, { $set: { enrollmentOpen: req.body.enrollmentOpen } }, { returnDocument: 'after' });
  return term ? res.json(termJson(term)) : notFound(res, 'Term');
});

// GET /api/offerings?term=<id>&search=<code or title>  (term defaults to the current one)
router.get('/offerings', async (req, res) => {
  const termId = validId(req.query.term) ? req.query.term : (await Term.findOne({ isCurrent: true }))?._id;
  if (!termId) return res.json([]);

  const filter = { term: termId };
  if (typeof req.query.search === 'string' && req.query.search.trim()) {
    const rx = new RegExp(escapeRegex(req.query.search.trim()), 'i');
    const subjects = await Subject.find({ $or: [{ code: rx }, { title: rx }] }).select('_id').limit(100);
    filter.subject = { $in: subjects.map((s) => s._id) };
  }
  const offerings = await Offering.find(filter).populate('subject', 'code title units').limit(80);
  res.json(
    offerings
      .sort((a, b) => a.subject.code.localeCompare(b.subject.code) || a.section.localeCompare(b.section))
      .map((o) => ({
        id: String(o._id),
        section: o.section,
        professor: o.professor,
        capacity: o.capacity,
        enrolledCount: o.enrolledCount,
        seatsLeft: Math.max(o.capacity - o.enrolledCount, 0),
        status: o.status,
        meetings: o.meetings.map(meetingJson),
        subject: { id: String(o.subject._id), code: o.subject.code, title: o.subject.title, units: o.subject.units },
      })),
  );
});

// ---------------------------------------------------------------------------------------------
// Academic information, enrollment history and grades
// ---------------------------------------------------------------------------------------------

// GET /api/students/:id/academic-summary
router.get('/students/:id/academic-summary', async (req, res) => {
  const student = await loadStudent(req, res);
  if (!student) return undefined;
  await student.populate('program');

  const rows = await loadRows(student._id);
  const standing = describeStanding(computeStanding(standingInput(rows), { unitsRequired: student.program?.totalUnits ?? null }), rows);

  const currentTerm = await Term.findOne({ isCurrent: true });
  const load = currentTerm ? rows.filter((r) => r.term.id === String(currentTerm._id) && r.status === 'Enrolled') : [];
  const [charges, payments, activeHolds] = await Promise.all([
    Charge.find({ student: student._id }),
    Payment.find({ student: student._id }),
    Hold.countDocuments({ student: student._id, status: 'Active' }),
  ]);

  return res.json({
    student: {
      id: String(student._id),
      studentId: student.studentId,
      course: student.course,
      yearLevel: student.yearLevel,
      section: student.section,
      status: student.status,
      academicStatus: student.academicStatus,
    },
    program: student.program ? { id: String(student.program._id), code: student.program.code, name: student.program.name, department: student.program.department, years: student.program.years, totalUnits: student.program.totalUnits } : null,
    standing,
    currentTerm: currentTerm ? termJson(currentTerm) : null,
    currentLoad: { subjects: load.length, units: load.reduce((sum, r) => sum + r.subject.units, 0) },
    activeHolds,
    balance: computeBalance(charges, payments).balance,
  });
});

// GET /api/students/:id/enrollments -> classes grouped by term, with schedule and grade
router.get('/students/:id/enrollments', async (req, res) => {
  const student = await loadStudent(req, res);
  if (!student) return undefined;
  const terms = groupByTerm(await loadRows(student._id)).map((g) => ({
    term: g.term,
    units: g.rows.filter((r) => r.status !== 'Dropped').reduce((sum, r) => sum + r.subject.units, 0),
    enrollments: g.rows,
  }));
  return res.json({ terms });
});

// GET /api/students/:id/grades -> grades by term, with each term's standing and the overall one
router.get('/students/:id/grades', async (req, res) => {
  const student = await loadStudent(req, res);
  if (!student) return undefined;
  await student.populate('program');
  const rows = await loadRows(student._id);
  const terms = groupByTerm(rows).map((g) => ({ term: g.term, rows: g.rows, standing: computeStanding(standingInput(g.rows)) }));
  const overall = describeStanding(computeStanding(standingInput(rows), { unitsRequired: student.program?.totalUnits ?? null }), rows);
  return res.json({ terms, overall });
});

// POST /api/students/:id/enrollments  { offeringId, skipPrerequisites? }  -> enroll in a class
router.post('/students/:id/enrollments', async (req, res) => {
  const student = await loadStudent(req, res);
  if (!student || refuseIfArchived(student, res)) return undefined;
  const { offeringId, skipPrerequisites } = req.body || {};
  if (!validId(offeringId)) return res.status(400).json({ message: 'offeringId is required' });
  // The admin may override a prerequisite; every other rule (seats, clashes, duplicates) still applies.
  const enrollment = await enrollStudent(student._id, offeringId, { skipPrerequisites: skipPrerequisites === true });
  return res.status(201).json({ id: String(enrollment._id), status: enrollment.status });
});

// POST /api/enrollments/:eid/drop
router.post('/enrollments/:eid/drop', async (req, res) => {
  if (!validId(req.params.eid)) return notFound(res, 'Enrollment');
  const dropped = await dropEnrollment(req.params.eid);
  return res.json({ id: String(dropped._id), status: dropped.status });
});

// PUT /api/enrollments/:eid/grade  { value }  or  { mark: 'INC' | 'DRP' | 'W' }
// Creates or replaces the final grade. A numeric grade or INC completes the class; DRP/W drops it.
router.put('/enrollments/:eid/grade', async (req, res) => {
  if (!validId(req.params.eid)) return notFound(res, 'Enrollment');
  const enrollment = await Enrollment.findById(req.params.eid);
  if (!enrollment) return notFound(res, 'Enrollment');
  const student = await Student.findById(enrollment.student).select('academicStatus');
  if (refuseIfArchived(student, res)) return undefined;
  if (enrollment.status === 'Dropped') return res.status(409).json({ message: 'A dropped class cannot be graded.' });

  const { value, mark } = req.body || {};
  const hasValue = typeof value === 'number';
  const hasMark = typeof mark === 'string' && mark !== '';
  if (hasValue === hasMark) return res.status(400).json({ message: 'Send either a numeric grade (value) or a mark (INC, DRP, W).' });
  const dropsClass = hasMark && DROP_MARKS.includes(mark);
  if (dropsClass && enrollment.status !== 'Enrolled') {
    return res.status(409).json({ message: 'DRP and W can only be recorded while the class is still in progress.' });
  }

  const grade = (await Grade.findOne({ enrollment: enrollment._id })) || new Grade({ student: enrollment.student, enrollment: enrollment._id });
  grade.value = hasValue ? value : undefined;
  grade.mark = hasMark ? mark : undefined;
  grade.postedBy = req.user.id;
  grade.postedAt = new Date();
  await grade.save(); // validates the scale and derives the remark

  if (dropsClass) {
    await dropEnrollment(enrollment._id); // frees the seat
  } else if (enrollment.status === 'Enrolled') {
    enrollment.status = 'Completed';
    await enrollment.save();
  }
  const status = (await Enrollment.findById(enrollment._id).select('status')).status;
  return res.json({ id: String(grade._id), value: grade.value ?? null, mark: grade.mark ?? null, remark: grade.remark, enrollmentStatus: status });
});

// DELETE /api/enrollments/:eid/grade -> remove a grade (the class goes back to "in progress")
router.delete('/enrollments/:eid/grade', async (req, res) => {
  if (!validId(req.params.eid)) return notFound(res, 'Enrollment');
  const grade = await Grade.findOne({ enrollment: req.params.eid });
  if (!grade) return notFound(res, 'Grade');
  if (DROP_MARKS.includes(grade.mark)) {
    return res.status(409).json({ message: 'This class was dropped. Enroll the student in it again instead of deleting the mark.' });
  }
  await grade.deleteOne();
  await Enrollment.updateOne({ _id: req.params.eid, status: 'Completed' }, { $set: { status: 'Enrolled' } });
  return res.json({ message: 'Grade removed' });
});

// ---------------------------------------------------------------------------------------------
// Attendance
// ---------------------------------------------------------------------------------------------
const ratePct = (present, total) => (total ? Math.round((present / total) * 100) : null);
const countsOf = (list) => {
  const c = { Present: 0, Absent: 0, Late: 0, Excused: 0 };
  for (const r of list) c[r.status] += 1;
  return { ...c, total: list.length, rate: ratePct(c.Present, list.length) };
};

// GET /api/students/:id/attendance?term=<id>  (term defaults to the current one)
router.get('/students/:id/attendance', async (req, res) => {
  const student = await loadStudent(req, res);
  if (!student) return undefined;
  const term = validId(req.query.term) ? await Term.findById(req.query.term) : await Term.findOne({ isCurrent: true });
  if (!term) return res.json({ term: null, totals: countsOf([]), byClass: [], records: [] });

  const records = await Attendance.find({ student: student._id, term: term._id })
    .populate({ path: 'offering', select: 'section subject', populate: { path: 'subject', select: 'code title' } })
    .sort({ date: -1 });

  const flat = records.map((r) => ({
    id: String(r._id),
    date: r.date,
    status: r.status,
    remarks: r.remarks,
    offeringId: String(r.offering._id),
    section: r.offering.section,
    subject: { code: r.offering.subject.code, title: r.offering.subject.title },
  }));
  const byOffering = new Map();
  for (const r of flat) {
    if (!byOffering.has(r.offeringId)) byOffering.set(r.offeringId, { offeringId: r.offeringId, subject: r.subject, section: r.section, list: [] });
    byOffering.get(r.offeringId).list.push(r);
  }
  const byClass = [...byOffering.values()]
    .map(({ list, ...rest }) => ({ ...rest, ...countsOf(list) }))
    .sort((a, b) => a.subject.code.localeCompare(b.subject.code));

  return res.json({ term: termJson(term), totals: countsOf(flat), byClass, records: flat });
});

// PUT /api/students/:id/attendance  { offeringId, date, status, remarks? }
// One record per student, class and day: sending the same day again updates it.
router.put('/students/:id/attendance', async (req, res) => {
  const student = await loadStudent(req, res);
  if (!student || refuseIfArchived(student, res)) return undefined;
  const { offeringId, date, status, remarks } = req.body || {};
  if (!validId(offeringId) || typeof date !== 'string') return res.status(400).json({ message: 'offeringId and date are required' });

  let record = await Attendance.findOne({ student: student._id, offering: offeringId, date });
  const created = !record;
  if (!record) record = new Attendance({ student: student._id, offering: offeringId, date });
  record.status = status;
  record.remarks = typeof remarks === 'string' ? remarks : record.remarks;
  record.recordedBy = req.user.id;
  await record.save(); // checks the student really is enrolled in this class, and the date is real
  return res.status(created ? 201 : 200).json({ id: String(record._id), date: record.date, status: record.status, remarks: record.remarks });
});

// DELETE /api/attendance/:aid
router.delete('/attendance/:aid', async (req, res) => {
  if (!validId(req.params.aid)) return notFound(res, 'Attendance record');
  const record = await Attendance.findByIdAndDelete(req.params.aid);
  if (!record) return notFound(res, 'Attendance record');
  return res.json({ message: 'Attendance record removed' });
});

// ---------------------------------------------------------------------------------------------
// Accounts and holds
// ---------------------------------------------------------------------------------------------
const moneyJson = (d) => ({
  id: String(d._id),
  amount: d.amount,
  term: d.term ? { id: String(d.term._id), name: d.term.name } : null,
  createdAt: d.createdAt,
});

// GET /api/students/:id/finance -> charges, payments, holds and the balance
router.get('/students/:id/finance', async (req, res) => {
  const student = await loadStudent(req, res);
  if (!student) return undefined;
  const [charges, payments, holds] = await Promise.all([
    Charge.find({ student: student._id }).populate('term', 'academicYear semester').sort({ createdAt: -1, _id: -1 }),
    Payment.find({ student: student._id }).populate('term', 'academicYear semester').sort({ paidAt: -1 }),
    Hold.find({ student: student._id }).sort({ status: 1, placedAt: -1 }), // Active before Cleared
  ]);
  return res.json({
    ...computeBalance(charges, payments),
    charges: charges.map((c) => ({ ...moneyJson(c), category: c.category, description: c.description, dueDate: c.dueDate })),
    payments: payments.map((p) => ({ ...moneyJson(p), method: p.method, receiptNo: p.receiptNo ?? '', paidAt: p.paidAt, note: p.note })),
    holds: holds.map((h) => ({ id: String(h._id), type: h.type, reason: h.reason, status: h.status, placedAt: h.placedAt, clearedAt: h.clearedAt })),
  });
});

const optionalTerm = (termId) => (validId(termId) ? termId : undefined);

// POST /api/students/:id/charges  { category, description, amount, termId?, dueDate? }
router.post('/students/:id/charges', async (req, res) => {
  const student = await loadStudent(req, res);
  if (!student || refuseIfArchived(student, res)) return undefined;
  const { category, description, amount, termId, dueDate } = req.body || {};
  const charge = await Charge.create({ student: student._id, term: optionalTerm(termId), category, description, amount, dueDate: dueDate || undefined });
  return res.status(201).json({ id: String(charge._id) });
});

// DELETE /api/charges/:cid  (for entries made by mistake)
router.delete('/charges/:cid', async (req, res) => {
  if (!validId(req.params.cid)) return notFound(res, 'Charge');
  const charge = await Charge.findByIdAndDelete(req.params.cid);
  return charge ? res.json({ message: 'Charge removed' }) : notFound(res, 'Charge');
});

// POST /api/students/:id/payments  { amount, method, termId?, receiptNo?, paidAt?, note? }
router.post('/students/:id/payments', async (req, res) => {
  const student = await loadStudent(req, res);
  if (!student || refuseIfArchived(student, res)) return undefined;
  const { amount, method, termId, receiptNo, paidAt, note } = req.body || {};
  try {
    const payment = await Payment.create({
      student: student._id, term: optionalTerm(termId), amount, method, paidAt: paidAt || undefined, note, recordedBy: req.user.id,
      receiptNo: typeof receiptNo === 'string' && receiptNo.trim() ? receiptNo.trim() : undefined,
    });
    return res.status(201).json({ id: String(payment._id) });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: 'That receipt number is already recorded.' });
    throw err;
  }
});

// DELETE /api/payments/:pid
router.delete('/payments/:pid', async (req, res) => {
  if (!validId(req.params.pid)) return notFound(res, 'Payment');
  const payment = await Payment.findByIdAndDelete(req.params.pid);
  return payment ? res.json({ message: 'Payment removed' }) : notFound(res, 'Payment');
});

// POST /api/students/:id/holds  { type, reason }
router.post('/students/:id/holds', async (req, res) => {
  const student = await loadStudent(req, res);
  if (!student || refuseIfArchived(student, res)) return undefined;
  const { type, reason } = req.body || {};
  try {
    const hold = await Hold.create({ student: student._id, type, reason, placedBy: req.user.id });
    return res.status(201).json({ id: String(hold._id) });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: `This student already has an active ${type} hold.` });
    throw err;
  }
});

// POST /api/holds/:hid/clear
router.post('/holds/:hid/clear', async (req, res) => {
  if (!validId(req.params.hid)) return notFound(res, 'Hold');
  const hold = await Hold.findById(req.params.hid);
  if (!hold) return notFound(res, 'Hold');
  if (hold.status === 'Cleared') return res.status(409).json({ message: 'This hold is already cleared.' });
  hold.status = 'Cleared';
  hold.clearedBy = req.user.id;
  await hold.save();
  return res.json({ id: String(hold._id), status: hold.status, clearedAt: hold.clearedAt });
});

module.exports = router;
