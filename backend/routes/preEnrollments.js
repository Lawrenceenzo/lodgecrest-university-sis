// Admin approval queue for pre-enrollment requests: review, approve (creates the real enrollments) or reject.

const express = require('express');
const mongoose = require('mongoose');
const { Student, PreEnrollment } = require('../models');
const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/roles');
const pre = require('../services/preEnrollment');
const { STATUSES } = require('../models/PreEnrollment');

const router = express.Router();
router.use(authenticate, requireRole('admin'));

const validId = (id) => typeof id === 'string' && mongoose.isValidObjectId(id);
const escapeRegex = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const STUDENT_FIELDS = 'studentId firstName middleName lastName suffix course yearLevel section academicStatus profilePicture';

const studentJson = (s) => ({
  id: String(s._id),
  studentId: s.studentId,
  name: `${s.lastName}, ${s.firstName}`,
  course: s.course,
  yearLevel: s.yearLevel,
  section: s.section,
  academicStatus: s.academicStatus,
  profilePicture: s.profilePicture,
});

async function describe(requests) {
  return requests.map((r) => ({ ...pre.requestJson(r), student: studentJson(r.student) }));
}

// GET /api/pre-enrollments/summary -> how many are waiting (for the badge in the menu)
router.get('/summary', async (req, res) => {
  res.json({ pending: await PreEnrollment.countDocuments({ status: 'Pending' }) });
});

// GET /api/pre-enrollments?status=Pending|Approved|Rejected|Cancelled|all&search=&term=
// Pending requests also carry a live review: what would stop (problems) or worry (warnings) an approval today.
router.get('/', async (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : 'Pending';
  const filter = {};
  if (STATUSES.includes(status)) filter.status = status;
  if (validId(req.query.term)) filter.term = req.query.term;
  if (typeof req.query.search === 'string' && req.query.search.trim()) {
    const rx = new RegExp(escapeRegex(req.query.search.trim().slice(0, 60)), 'i');
    filter.student = { $in: await Student.find({ $or: [{ studentId: rx }, { firstName: rx }, { lastName: rx }] }).limit(200).distinct('_id') };
  }

  const [docs, countRows] = await Promise.all([
    PreEnrollment.find(filter).sort(status === 'Pending' ? { submittedAt: 1 } : { submittedAt: -1 }).limit(100).populate(pre.POPULATE).populate('student', STUDENT_FIELDS),
    PreEnrollment.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
  ]);
  const requests = await describe(docs);
  for (const request of requests) {
    if (request.status !== 'Pending') continue;
    const r = await pre.evaluateSelection(request.student.id, request.items.map((i) => i.offeringId));
    request.review = { ok: r.ok, problems: r.problems, warnings: r.warnings };
  }
  const counts = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  for (const row of countRows) counts[row._id] = row.n;
  res.json({ counts, requests });
});

// POST /api/pre-enrollments/:id/approve  { allowConditional? }
router.post('/:id/approve', async (req, res) => {
  if (!validId(req.params.id)) return res.status(404).json({ message: 'Pre-enrollment request not found' });
  const request = await pre.approvePreEnrollment(req.params.id, req.user.id, { allowConditional: req.body?.allowConditional === true });
  return res.json({ id: String(request._id), status: request.status, enrollments: request.enrollments.length });
});

// POST /api/pre-enrollments/:id/reject  { note }   (the student sees the note)
router.post('/:id/reject', async (req, res) => {
  if (!validId(req.params.id)) return res.status(404).json({ message: 'Pre-enrollment request not found' });
  const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';
  if (note.length < 3) return res.status(400).json({ message: 'Give the student a reason (at least 3 characters).' });
  if (note.length > 300) return res.status(400).json({ message: 'The reason must be 300 characters or fewer.' });
  const request = await pre.rejectPreEnrollment(req.params.id, req.user.id, note);
  return res.json({ id: String(request._id), status: request.status });
});

module.exports = router;
