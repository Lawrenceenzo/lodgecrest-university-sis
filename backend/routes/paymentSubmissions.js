// Admin side of "submit a payment with proof": review what students sent in, look at the proof image,
// then approve (a real Payment is recorded and the balance drops) or reject (with a reason the student can read).

const express = require('express');
const mongoose = require('mongoose');
const { Student, Charge, Payment, PaymentSubmission } = require('../models');
const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/roles');
const { proofPath, TYPES } = require('../middleware/uploadProof');
const { computeBalance } = require('../services/accounts');
const { STATUSES } = require('../models/PaymentSubmission');

const router = express.Router();
router.use(authenticate, requireRole('admin'));

const validId = (id) => typeof id === 'string' && mongoose.isValidObjectId(id);
const escapeRegex = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const STUDENT_FIELDS = 'studentId firstName lastName course yearLevel section academicStatus profilePicture';

const balanceOf = async (studentId) => {
  const [charges, payments] = await Promise.all([Charge.find({ student: studentId }), Payment.find({ student: studentId })]);
  return computeBalance(charges, payments).balance;
};

const submissionJson = (p, balance) => ({
  id: String(p._id),
  student: {
    id: String(p.student._id),
    studentId: p.student.studentId,
    name: `${p.student.lastName}, ${p.student.firstName}`,
    course: p.student.course,
    yearLevel: p.student.yearLevel,
    section: p.student.section,
    academicStatus: p.student.academicStatus,
    profilePicture: p.student.profilePicture,
  },
  amount: p.amount,
  method: p.method,
  referenceNo: p.referenceNo,
  paidOn: p.paidOn,
  note: p.note,
  status: p.status,
  reason: p.reason,
  submittedAt: p.submittedAt,
  decidedAt: p.decidedAt,
  ...(balance !== undefined && { balance }),
});

// GET /api/payment-submissions/summary -> how many are waiting (for the badge in the menu)
router.get('/summary', async (req, res) => {
  res.json({ pending: await PaymentSubmission.countDocuments({ status: 'Pending' }) });
});

// GET /api/payment-submissions?status=Pending|Approved|Rejected|all&search=
// Pending ones also carry the student's current balance, so you can judge the amount.
router.get('/', async (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : 'Pending';
  const filter = STATUSES.includes(status) ? { status } : {};
  if (typeof req.query.search === 'string' && req.query.search.trim()) {
    const rx = new RegExp(escapeRegex(req.query.search.trim().slice(0, 60)), 'i');
    const ids = await Student.find({ $or: [{ studentId: rx }, { firstName: rx }, { lastName: rx }] }).limit(200).distinct('_id');
    filter.$or = [{ student: { $in: ids } }, { referenceNo: rx }];
  }
  const [docs, countRows] = await Promise.all([
    PaymentSubmission.find(filter).sort(status === 'Pending' ? { submittedAt: 1 } : { submittedAt: -1 }).limit(100).populate('student', STUDENT_FIELDS),
    PaymentSubmission.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
  ]);
  const submissions = [];
  for (const d of docs) submissions.push(submissionJson(d, d.status === 'Pending' ? await balanceOf(d.student._id) : undefined));
  const counts = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  for (const row of countRows) counts[row._id] = row.n;
  res.json({ counts, submissions });
});

// GET /api/payment-submissions/:id/proof -> the image the student uploaded (read through the API only)
router.get('/:id/proof', async (req, res) => {
  const found = validId(req.params.id) ? await PaymentSubmission.findById(req.params.id).select('proof') : null;
  const file = found && proofPath(found.proof);
  if (!file) return res.status(404).json({ message: 'Proof of payment not found' });
  const type = found.proof.endsWith('.png') ? 'image/png' : 'image/jpeg';
  return res.sendFile(file, { dotfiles: 'deny', cacheControl: false, headers: { 'Cache-Control': 'private, no-store', 'Content-Type': TYPES[type].contentType, 'Content-Disposition': 'inline', 'X-Content-Type-Options': 'nosniff' } }, (err) => {
    if (err && !res.headersSent) res.status(404).json({ message: 'The proof file is missing from the server' });
  });
});

// PUT /api/payment-submissions/:id/verify  { decision: 'Approved' | 'Rejected', reason? }
//   Approved -> a Payment is recorded on the student's account (so the balance drops) in the same step.
//   Rejected -> a reason (3 to 300 characters) is required; the student reads it and may submit again.
// A submission is decided once: the status change is made first, in one atomic update, so two administrators
// clicking at the same moment cannot record the payment twice.
router.put('/:id/verify', async (req, res) => {
  if (!validId(req.params.id)) return res.status(404).json({ message: 'Payment submission not found' });
  const decision = req.body?.decision;
  if (decision !== 'Approved' && decision !== 'Rejected') return res.status(400).json({ message: 'decision must be Approved or Rejected' });
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
  if (decision === 'Rejected' && (reason.length < 3 || reason.length > 300)) {
    return res.status(400).json({ message: 'Give the student a reason (3 to 300 characters).' });
  }

  const existing = await PaymentSubmission.findById(req.params.id).populate('student', 'studentId firstName lastName academicStatus');
  if (!existing) return res.status(404).json({ message: 'Payment submission not found' });
  if (existing.status !== 'Pending') return res.status(409).json({ message: `This payment was already ${existing.status.toLowerCase()}.` });
  if (decision === 'Approved' && existing.student.academicStatus === 'Archived') {
    return res.status(409).json({ message: 'This student is archived. Restore the record before approving a payment.' });
  }

  const now = new Date();
  const claimed = await PaymentSubmission.findOneAndUpdate(
    { _id: existing._id, status: 'Pending' },
    decision === 'Approved'
      ? { $set: { status: 'Approved', decidedAt: now, decidedBy: req.user.id } }
      : { $set: { status: 'Rejected', decidedAt: now, decidedBy: req.user.id, reason }, $unset: { activeKey: 1 } },
    { returnDocument: 'after' },
  );
  if (!claimed) return res.status(409).json({ message: 'Someone else has just decided this payment.' });

  if (decision === 'Rejected') return res.json({ id: String(claimed._id), status: 'Rejected', reason });

  try {
    const payment = await Payment.create({
      student: claimed.student,
      term: claimed.term,
      amount: claimed.amount,
      method: claimed.method,
      receiptNo: claimed.referenceNo,
      paidAt: new Date(`${claimed.paidOn}T00:00:00Z`),
      note: `Submitted online${claimed.note ? `: ${claimed.note}` : ''}`.slice(0, 200),
      recordedBy: req.user.id,
    });
    await PaymentSubmission.updateOne({ _id: claimed._id }, { $set: { payment: payment._id } });
    return res.json({ id: String(claimed._id), status: 'Approved', paymentId: String(payment._id), balance: await balanceOf(claimed.student) });
  } catch (err) {
    // Nothing was recorded, so put the submission back as it was and say why.
    await PaymentSubmission.updateOne({ _id: claimed._id }, { $set: { status: 'Pending' }, $unset: { decidedAt: 1, decidedBy: 1 } });
    if (err.code === 11000) return res.status(409).json({ message: `The reference number ${claimed.referenceNo} is already on a recorded payment, so this cannot be approved. Reject it or correct the existing payment.` });
    throw err;
  }
});

module.exports = router;
